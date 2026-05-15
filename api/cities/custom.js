import { getCustomCities, upsertCustomCity, deleteCustomCity } from '../_db.js';
import { getHospitalId } from '../_hospital.js';

export default async function handler(req, res) {
  const hospitalId = getHospitalId(req);

  if (req.method === 'GET') {
    return res.json(await getCustomCities(hospitalId));
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { city, county, lat, lon } = req.body;
    if (!city || lat == null || lon == null) {
      return res.status(400).json({ error: 'city, lat, and lon are required' });
    }
    await upsertCustomCity({ city: city.trim(), county: county?.trim() || '', lat: +lat, lon: +lon }, hospitalId);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'city required' });
    await deleteCustomCity(city, hospitalId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
