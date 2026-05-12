import { getMonthlyBreakdown } from './_db.js';

export default async function handler(req, res) {
  const { year, type = 'city' } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });
  const rows = await getMonthlyBreakdown(year, type);
  res.json(rows);
}
