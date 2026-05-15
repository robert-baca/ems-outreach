import { getMonthlyBreakdown } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;
  const { year, type = 'city' } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });
  res.json(await getMonthlyBreakdown(year, type, hospitalId));
}
