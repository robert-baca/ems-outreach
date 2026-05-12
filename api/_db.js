import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

function db() {
  return neon(process.env.DATABASE_URL);
}

export async function initDB() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS transports (
    id TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    county TEXT,
    transport_count INTEGER DEFAULT 1,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE transports ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'city'`;
  await sql`CREATE TABLE IF NOT EXISTS custom_cities (
    city TEXT PRIMARY KEY,
    county TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL
  )`;
}

export async function getTransports({ month, year, type = 'city' }) {
  const sql = db();
  await initDB();
  return sql`
    SELECT * FROM transports
    WHERE month = ${+month} AND year = ${+year}
      AND COALESCE(type, 'city') = ${type}
    ORDER BY created_at DESC
  `;
}

export async function getStats({ month, year, type = 'city' }) {
  const sql = db();
  await initDB();
  if (month) {
    return sql`
      SELECT city, county, SUM(transport_count)::int AS total
      FROM transports
      WHERE month = ${+month} AND year = ${+year}
        AND COALESCE(type, 'city') = ${type}
      GROUP BY city, county ORDER BY total DESC
    `;
  }
  return sql`
    SELECT city, county, SUM(transport_count)::int AS total
    FROM transports
    WHERE year = ${+year} AND COALESCE(type, 'city') = ${type}
    GROUP BY city, county ORDER BY total DESC
  `;
}

export async function getCityHistory(city) {
  const sql = db();
  await initDB();
  const rows = await sql`
    SELECT year, month, SUM(transport_count)::int AS total
    FROM transports
    WHERE LOWER(city) = LOWER(${city})
      AND COALESCE(type, 'city') = 'city'
    GROUP BY year, month
    ORDER BY year, month
  `;
  return rows.map(r => ({ year: +r.year, month: +r.month, total: +r.total }));
}

export async function addTransport({ city, county, transport_count, month, year, type = 'city' }) {
  const sql = db();
  await initDB();
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO transports (id, city, county, transport_count, month, year, type)
    VALUES (${id}, ${city}, ${county ?? null}, ${+transport_count || 1}, ${+month}, ${+year}, ${type})
    RETURNING *
  `;
  return rows[0];
}

export async function deleteTransport(id) {
  const sql = db();
  await initDB();
  await sql`DELETE FROM transports WHERE id = ${id}`;
}

export async function getCustomCities() {
  const sql = db();
  await initDB();
  return sql`SELECT * FROM custom_cities ORDER BY city`;
}

export async function getMonthlyBreakdown(year, type = 'city') {
  const sql = db();
  await initDB();
  return sql`
    SELECT city, month, SUM(transport_count)::int AS total
    FROM transports
    WHERE year = ${+year} AND COALESCE(type, 'city') = ${type}
    GROUP BY city, month
    ORDER BY city, month
  `;
}

export async function upsertCustomCity({ city, county, lat, lon }) {
  const sql = db();
  await initDB();
  await sql`
    INSERT INTO custom_cities (city, county, lat, lon)
    VALUES (${city}, ${county ?? ''}, ${lat}, ${lon})
    ON CONFLICT (city) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, county = EXCLUDED.county
  `;
}

export async function deleteCustomCity(city) {
  const sql = db();
  await initDB();
  await sql`DELETE FROM custom_cities WHERE LOWER(city) = LOWER(${city})`;
}
