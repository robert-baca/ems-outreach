import { getHospitalConfig } from './_db.js';
import { getHospitalId } from './_hospital.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const config = await getHospitalConfig(getHospitalId(req));
  res.json(config);
}
