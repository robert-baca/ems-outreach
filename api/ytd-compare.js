import { getYtdCompare } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { throughMonth, compareYear, type = 'city' } = req.query;
  if (!throughMonth || !compareYear) return res.status(400).json({ error: 'throughMonth and compareYear required' });
  const rows = await getYtdCompare({ throughMonth, compareYear, type });
  res.json(rows);
}
