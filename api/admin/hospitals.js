import { createClerkClient } from '@clerk/backend';
import { getHospitalConfig, initDB } from '../_db.js';
import { neon } from '@neondatabase/serverless';
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
  return { hospitalId, userId, clerk };
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const sql = neon(process.env.DATABASE_URL);
  await initDB();

  // List all hospitals
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM hospitals ORDER BY name`;
    return res.json(rows);
  }

  // Create a new hospital
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

  res.status(405).end();
}
