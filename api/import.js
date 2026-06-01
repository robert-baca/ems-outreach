import { addTransport, getCustomCities, upsertCustomCity, getExistingKeys } from './_db.js';
import { geocodeCity } from './_geocode.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  const { records = [], newCities = [] } = req.body;

  const existing = await getCustomCities(hospitalId);
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
        await upsertCustomCity(entry, hospitalId);
        geocodedResults.push(entry);
        existingSet.add(name.toLowerCase());
      } else {
        failed.push(name);
      }
    } catch {
      failed.push(name);
    }
  }

  // Build set of already-existing city+month+year+type keys to skip duplicates
  const years = [...new Set(records.map(r => +r.year).filter(Boolean))];
  const existingKeys = years.length > 0 ? await getExistingKeys(years, hospitalId) : new Set();

  let saved = 0, skipped = 0;
  for (const rec of records) {
    const key = `${rec.city.toLowerCase()}|${rec.month}|${rec.year}|${rec.type || 'city'}`;
    if (existingKeys.has(key)) { skipped++; continue; }
    try { await addTransport(rec, hospitalId); saved++; } catch {}
  }

  res.json({ saved, skipped, geocoded: geocodedResults.length, geocodedCities: geocodedResults, failed });
}
