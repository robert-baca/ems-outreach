import { createClerkClient } from '@clerk/backend';
import { requireAuth } from '../_auth.js';

async function requireAdmin(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return null;

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const token = req.headers?.authorization?.replace('Bearer ', '');
  const { sub: userId } = await clerk.verifyToken(token);
  const user = await clerk.users.getUser(userId);

  if (!user.publicMetadata?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return { clerk, currentUserId: userId };
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { clerk } = auth;

  // List all users with their hospital assignment
  if (req.method === 'GET') {
    const { data: users } = await clerk.users.getUserList({ limit: 100 });
    return res.json(users.map(u => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
      hospitalId: u.publicMetadata?.hospitalId ?? null,
      isAdmin: u.publicMetadata?.isAdmin ?? false,
    })));
  }

  // Assign a hospital to a user: { userId, hospitalId }
  if (req.method === 'POST') {
    const { userId, hospitalId, isAdmin } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const meta = {};
    if (hospitalId !== undefined) meta.hospitalId = hospitalId;
    if (isAdmin !== undefined) meta.isAdmin = isAdmin;
    await clerk.users.updateUserMetadata(userId, { publicMetadata: meta });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
