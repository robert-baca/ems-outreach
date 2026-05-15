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
  await sql`CREATE TABLE IF NOT EXISTS city_aliases (
    alias TEXT PRIMARY KEY,
    canonical TEXT NOT NULL
  )`;
}

export async function getAliases() {
  const sql = db();
  await initDB();
  return sql`SELECT alias, canonical FROM city_aliases ORDER BY alias`;
}

export async function setAlias(alias, canonical, changeType = false) {
  const sql = db();
  await initDB();
  await sql`
    INSERT INTO city_aliases (alias, canonical)
    VALUES (${alias}, ${canonical})
    ON CONFLICT (alias) DO UPDATE SET canonical = EXCLUDED.canonical
  `;
  if (changeType) {
    await sql`UPDATE transports SET city = ${canonical}, type = 'city' WHERE LOWER(city) = LOWER(${alias})`;
  } else {
    await sql`UPDATE transports SET city = ${canonical} WHERE LOWER(city) = LOWER(${alias})`;
  }
}

export async function deleteAlias(alias) {
  const sql = db();
  await initDB();
  await sql`DELETE FROM city_aliases WHERE LOWER(alias) = LOWER(${alias})`;
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
  const aliasRows = await sql`SELECT canonical FROM city_aliases WHERE LOWER(alias) = LOWER(${city}) LIMIT 1`;
  const resolvedCity = aliasRows.length ? aliasRows[0].canonical : city;
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO transports (id, city, county, transport_count, month, year, type)
    VALUES (${id}, ${resolvedCity}, ${county ?? null}, ${+transport_count || 1}, ${+month}, ${+year}, ${type})
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

export async function getYtdCompare({ throughMonth, compareYear, type = 'city' }) {
  const sql = db();
  await initDB();
  const baseYear = +compareYear - 1;
  const rows = await sql`
    SELECT city, county, year, SUM(transport_count)::int AS total
    FROM transports
    WHERE year IN (${baseYear}, ${+compareYear})
      AND month <= ${+throughMonth}
      AND COALESCE(type, 'city') = ${type}
    GROUP BY city, county, year
    ORDER BY city, year
  `;
  const map = {};
  for (const r of rows) {
    if (!map[r.city]) map[r.city] = { city: r.city, county: r.county, base: 0, compare: 0 };
    if (+r.year === baseYear) map[r.city].base = r.total;
    else map[r.city].compare = r.total;
  }
  return Object.values(map).sort((a, b) => b.compare - a.compare || b.base - a.base);
}
