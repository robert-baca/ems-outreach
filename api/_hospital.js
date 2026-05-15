import { createClerkClient } from '@clerk/backend';

// Returns the hospital ID for the current request, or null if unauthenticated.
// When CLERK_SECRET_KEY is not set (local dev without auth), falls back to 'grapevine'.
export async function getHospitalId(req) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return 'grapevine'; // local dev fallback

  const token =
    req.headers?.authorization?.replace('Bearer ', '') ||
    req.cookies?.__session;

  if (!token) return null;

  try {
    const clerk = createClerkClient({ secretKey });
    const { sub: userId } = await clerk.verifyToken(token);
    if (!userId) return null;
    const user = await clerk.users.getUser(userId);
    return user.publicMetadata?.hospitalId ?? null;
  } catch {
    return null;
  }
}

export function isAdminUser(user) {
  return user?.publicMetadata?.isAdmin === true;
}
