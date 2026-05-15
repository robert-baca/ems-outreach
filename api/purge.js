import { deleteAllByName } from './_db.js';
import { getHospitalId } from './_hospital.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const { city, type } = req.body;
  if (!city || !type) return res.status(400).json({ error: 'city and type required' });
  await deleteAllByName(city, type, getHospitalId(req));
  res.json({ ok: true });
}
