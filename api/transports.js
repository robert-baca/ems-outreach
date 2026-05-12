import { getTransports, addTransport, getCustomCities, upsertCustomCity } from './_db.js';
import { geocodeCity } from './_geocode.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await getTransports(req.query));
  }

  if (req.method === 'POST') {
    const { city, county, transport_count, month, year, type = 'city', knownCities = [] } = req.body;
    if (!city || !month || !year)
      return res.status(400).json({ error: 'city, month, and year are required' });

    let newCity = null;
    if (type === 'city') {
      const customCities = await getCustomCities();
      const knownSet = new Set([
        ...customCities.map(c => c.city.toLowerCase()),
        ...knownCities.map(c => c.toLowerCase()),
      ]);
      if (!knownSet.has(city.toLowerCase())) {
        const coords = await geocodeCity(city);
        if (coords) {
          newCity = { city, county: county ?? '', ...coords };
          await upsertCustomCity(newCity);
        }
      }
    }

    const record = await addTransport({ city, county, transport_count, month, year, type });
    return res.status(201).json({ ...record, newCity });
  }

  res.status(405).end();
}
