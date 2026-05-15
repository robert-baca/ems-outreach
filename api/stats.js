import { getStats } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;
  res.json(await getStats(req.query, hospitalId));
}
