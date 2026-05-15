import { getMonthlyBreakdown, getYtdCompare } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  // ?mode=ytd → year-vs-year comparison (was /api/ytd-compare)
  if (req.query.mode === 'ytd') {
    const { throughMonth, compareYear, type = 'city' } = req.query;
    if (!throughMonth || !compareYear) return res.status(400).json({ error: 'throughMonth and compareYear required' });
    return res.json(await getYtdCompare({ throughMonth, compareYear, type }, hospitalId));
  }

  const { year, type = 'city' } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });
  res.json(await getMonthlyBreakdown(year, type, hospitalId));
}
