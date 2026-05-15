import { getCityHistory, getCustomCities, upsertCustomCity, deleteCustomCity } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  // GET ?mode=history&city=X — city transport history (was /api/city-history)
  if (req.method === 'GET' && req.query.mode === 'history') {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'city is required' });
    return res.json(await getCityHistory(city, hospitalId));
  }

  // GET — list custom pin cities (was /api/cities/custom)
  if (req.method === 'GET') {
    return res.json(await getCustomCities(hospitalId));
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { city, county, lat, lon } = req.body;
    if (!city || lat == null || lon == null)
      return res.status(400).json({ error: 'city, lat, and lon are required' });
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
