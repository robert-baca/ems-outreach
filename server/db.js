import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'data.json');

function load() {
  if (!existsSync(FILE)) return { transports: [], nextId: 1 };
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getTransports({ month, year } = {}) {
  const { transports } = load();
  return transports.filter(t =>
    (month == null || t.month === +month) &&
    (year  == null || t.year  === +year)
  ).sort((a, b) => b.id - a.id);
}

export function getStats({ month, year } = {}) {
  const rows = getTransports({ month, year });
  const map = {};
  for (const t of rows) {
    const key = t.city.toLowerCase();
    if (!map[key]) map[key] = { city: t.city, county: t.county, total: 0 };
    map[key].total += t.transport_count;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function addTransport(entry) {
  const data = load();
  const record = { id: data.nextId++, ...entry, created_at: new Date().toISOString() };
  data.transports.push(record);
  save(data);
  return record;
}

export function deleteTransport(id) {
  const data = load();
  data.transports = data.transports.filter(t => t.id !== +id);
  save(data);
}

// All monthly totals for one city, sorted chronologically
export function getCityHistory(city) {
  const { transports } = load();
  const map = {};
  transports
    .filter(t => t.city.toLowerCase() === city.toLowerCase())
    .forEach(t => {
      const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + t.transport_count;
    });
  return Object.entries(map)
    .map(([key, total]) => {
      const [year, month] = key.split('-');
      return { year: +year, month: +month, total };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
