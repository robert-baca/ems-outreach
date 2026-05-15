import { getTransports, addTransport, getCustomCities, upsertCustomCity, deleteAllByName } from './_db.js';
import { geocodeCity } from './_geocode.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  if (req.method === 'GET') {
    return res.json(await getTransports(req.query, hospitalId));
  }

  if (req.method === 'POST') {
    const { city, county, transport_count, month, year, type = 'city', knownCities = [] } = req.body;
    if (!city || !month || !year)
      return res.status(400).json({ error: 'city, month, and year are required' });

    let newCity = null;
    if (type === 'city') {
      const customCities = await getCustomCities(hospitalId);
      const knownSet = new Set([
        ...customCities.map(c => c.city.toLowerCase()),
        ...knownCities.map(c => c.toLowerCase()),
      ]);
      if (!knownSet.has(city.toLowerCase())) {
        const coords = await geocodeCity(city);
        if (coords) {
          newCity = { city, county: county ?? '', ...coords };
          await upsertCustomCity(newCity, hospitalId);
        }
      }
    }

    const record = await addTransport({ city, county, transport_count, month, year, type }, hospitalId);
    return res.status(201).json({ ...record, newCity });
  }

  // DELETE without an ID = purge all records for a city/type
  if (req.method === 'DELETE') {
    const { city, type } = req.body;
    if (!city || !type) return res.status(400).json({ error: 'city and type required' });
    await deleteAllByName(city, type, hospitalId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
