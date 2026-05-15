import { createClerkClient } from '@clerk/backend';
import { initDB } from './_db.js';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

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
  return { hospitalId, userId, clerk };
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { resource } = req.query;

  // --- Hospitals (was /api/admin/hospitals) ---
  if (resource === 'hospitals') {
    const sql = neon(process.env.DATABASE_URL);
    await initDB();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM hospitals ORDER BY name`;
      return res.json(rows);
    }

    if (req.method === 'POST') {
      const { id, name, subtitle, address, lat, lon, map_zoom = 10 } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'id and name required' });
      await sql`
        INSERT INTO hospitals (id, name, subtitle, address, lat, lon, map_zoom)
        VALUES (${id}, ${name}, ${subtitle ?? ''}, ${address ?? ''}, ${lat ?? null}, ${lon ?? null}, ${map_zoom})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, subtitle = EXCLUDED.subtitle,
          address = EXCLUDED.address, lat = EXCLUDED.lat, lon = EXCLUDED.lon, map_zoom = EXCLUDED.map_zoom
      `;
      return res.json({ ok: true });
    }

    return res.status(405).end();
  }

  // --- Users (was /api/admin/users) ---
  if (resource === 'users') {
    const { clerk } = auth;

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

    if (req.method === 'POST') {
      const { userId, hospitalId, isAdmin } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const meta = {};
      if (hospitalId !== undefined) meta.hospitalId = hospitalId;
      if (isAdmin !== undefined) meta.isAdmin = isAdmin;
      await clerk.users.updateUserMetadata(userId, { publicMetadata: meta });
      return res.json({ ok: true });
    }

    return res.status(405).end();
  }

  res.status(400).json({ error: 'resource param required (hospitals or users)' });
}
