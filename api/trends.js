import { getMonthlyBreakdown } from './_db.js';
import { getHospitalId } from './_hospital.js';

export default async function handler(req, res) {
  const { year, type = 'city' } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });
  const rows = await getMonthlyBreakdown(year, type, getHospitalId(req));
  res.json(rows);
}
