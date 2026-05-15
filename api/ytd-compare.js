import { getYtdCompare } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;
  const { throughMonth, compareYear, type = 'city' } = req.query;
  if (!throughMonth || !compareYear) return res.status(400).json({ error: 'throughMonth and compareYear required' });
  res.json(await getYtdCompare({ throughMonth, compareYear, type }, hospitalId));
}
