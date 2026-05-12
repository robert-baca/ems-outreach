import { addTransport, getCustomCities, upsertCustomCity } from './_db.js';
import { geocodeCity } from './_geocode.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { records = [], newCities = [] } = req.body;

  const existing = await getCustomCities();
  const existingSet = new Set(existing.map(c => c.city.toLowerCase()));
  const geocodedResults = [];
  const failed = [];

  for (const name of newCities) {
    if (existingSet.has(name.toLowerCase())) continue;
    try {
      await new Promise(r => setTimeout(r, 1200));
      const coords = await geocodeCity(name);
      if (coords) {
        const entry = { city: name, county: '', ...coords };
        await upsertCustomCity(entry);
        geocodedResults.push(entry);
        existingSet.add(name.toLowerCase());
      } else {
        failed.push(name);
      }
    } catch {
      failed.push(name);
    }
  }

  let saved = 0;
  for (const rec of records) {
    try { await addTransport(rec); saved++; } catch {}
  }

  res.json({ saved, geocoded: geocodedResults.length, geocodedCities: geocodedResults, failed });
}
