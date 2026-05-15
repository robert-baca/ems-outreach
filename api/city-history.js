import { getCityHistory } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required' });
  res.json(await getCityHistory(city, hospitalId));
}
