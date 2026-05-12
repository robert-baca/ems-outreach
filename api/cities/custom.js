import { getCustomCities } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.json(await getCustomCities());
}
