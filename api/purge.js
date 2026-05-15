import { deleteAllByName } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;
  const { city, type } = req.body;
  if (!city || !type) return res.status(400).json({ error: 'city and type required' });
  await deleteAllByName(city, type, hospitalId);
  res.json({ ok: true });
}
