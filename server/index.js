import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getTransports, getStats, addTransport, deleteTransport, getCityHistory } from './db.js';
import Anthropic from '@anthropic-ai/sdk';

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

app.delete('/api/purge', (req, res) => {
  const { city, type } = req.body;
  if (!city || !type) return res.status(400).json({ error: 'city and type required' });
  const dataFile = join(__dirname, 'data.json');
  if (!existsSync(dataFile)) return res.json({ ok: true });
  const data = JSON.parse(readFileSync(dataFile, 'utf8'));
  data.transports = data.transports.filter(
    t => !(t.city.toLowerCase() === city.toLowerCase() && (t.type || 'city') === type)
  );
  writeFileSync(dataFile, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// ── AI Ask endpoint ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an EMS outreach analytics assistant for Baylor Scott & White Medical Center – Grapevine, TX. \
You help the outreach coordinator understand transport patterns, identify growth opportunities, and make data-driven decisions.

Your role is to:
- Analyze transport volume trends across cities and agencies in the DFW metroplex
- Identify cities or agencies with unusually high or low activity
- Suggest outreach strategies to improve relationships with EMS agencies
- Highlight month-over-month or year-over-year patterns
- Point out which counties or areas need more attention
- Be concise, practical, and grounded in the data provided

The user will provide current stats context in their message. Respond conversationally but keep answers focused and actionable.`;

app.post('/api/ask', async (req, res) => {
  const { question, context } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const client = new Anthropic({ apiKey });
  const userMessage = context ? `${context}\n\nMy question: ${question}` : question;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Ask API error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
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
