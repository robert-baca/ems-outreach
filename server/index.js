import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getTransports, getStats, addTransport, deleteTransport, getCityHistory } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Custom cities (geocoded from imports) ─────────────────────────────────────
const CUSTOM_CITIES_FILE = join(__dirname, 'custom_cities.json');

function loadCustomCities() {
  if (!existsSync(CUSTOM_CITIES_FILE)) return [];
  return JSON.parse(readFileSync(CUSTOM_CITIES_FILE, 'utf8'));
}
function saveCustomCities(cities) {
  writeFileSync(CUSTOM_CITIES_FILE, JSON.stringify(cities, null, 2));
}

app.get('/api/cities/custom', (req, res) => {
  res.json(loadCustomCities());
});

// ── Geocode a single city name via Nominatim (server-side, respects rate limit)
async function geocodeCity(name) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', Texas, USA')}&format=json&limit=1`;
  const r = await fetch(url, { headers: { 'User-Agent': 'EMS-Outreach-App/1.0 (ems@baylorscottwhite.com)' } });
  const results = await r.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

// ── Import endpoint ────────────────────────────────────────────────────────────
// Body: { records: [{city,county,transport_count,service_line,ems_agency,month,year}],
//         newCities: ["City Name", ...] }
app.post('/api/import', async (req, res) => {
  const { records = [], newCities = [] } = req.body;

  // Geocode any cities not already in the custom list
  const existing = loadCustomCities();
  const existingSet = new Set(existing.map(c => c.city.toLowerCase()));
  const geocodedResults = [];
  const failed = [];

  for (const name of newCities) {
    if (existingSet.has(name.toLowerCase())) continue;
    try {
      await new Promise(r => setTimeout(r, 1200)); // Nominatim: max 1 req/sec
      const coords = await geocodeCity(name);
      if (coords) {
        const entry = { city: name, county: '', ...coords };
        existing.push(entry);
        geocodedResults.push(entry);
        existingSet.add(name.toLowerCase());
      } else {
        failed.push(name);
      }
    } catch (err) {
      failed.push(name);
    }
  }

  if (geocodedResults.length > 0) saveCustomCities(existing);

  // Save transport records
  let saved = 0;
  for (const rec of records) {
    try { addTransport(rec); saved++; } catch {}
  }

  res.json({ saved, geocoded: geocodedResults.length, geocodedCities: geocodedResults, failed });
});

// ── Transport CRUD ─────────────────────────────────────────────────────────────
app.get('/api/transports', (req, res) => res.json(getTransports(req.query)));
app.get('/api/stats',      (req, res) => res.json(getStats(req.query)));

app.get('/api/city-history', (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required' });
  res.json(getCityHistory(city));
});

app.post('/api/transports', async (req, res) => {
  const { city, county, transport_count, month, year, knownCities = [] } = req.body;
  if (!city || !month || !year) return res.status(400).json({ error: 'city, month, and year are required' });

  // Geocode if city isn't in built-in list or custom list
  let newCity = null;
  const existing = loadCustomCities();
  const existingSet = new Set([
    ...existing.map(c => c.city.toLowerCase()),
    ...knownCities.map(c => c.toLowerCase()),
  ]);
  if (!existingSet.has(city.toLowerCase())) {
    try {
      const coords = await geocodeCity(city);
      if (coords) {
        newCity = { city, county: county ?? '', ...coords };
        existing.push(newCity);
        saveCustomCities(existing);
      }
    } catch {}
  }

  const record = addTransport({
    city, county: county ?? null,
    transport_count: +transport_count || 1,
    service_line: null, ems_agency: null,
    month: +month, year: +year,
  });
  res.status(201).json({ ...record, newCity });
});

app.delete('/api/transports/:id', (req, res) => {
  deleteTransport(req.params.id);
  res.json({ success: true });
});

// ── Serve React build ──────────────────────────────────────────────────────────
const distPath = join(__dirname, '../client/dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`EMS Outreach → http://localhost:${PORT}`)
);
