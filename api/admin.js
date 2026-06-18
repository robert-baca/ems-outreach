import { initDB } from './_db.js';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  const { resource } = req.query;

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

  res.status(400).json({ error: 'resource param required (hospitals)' });
}
