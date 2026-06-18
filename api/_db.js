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
  await sql`CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT,
    address TEXT,
    lat REAL,
    lon REAL,
    map_zoom INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE transports    ADD COLUMN IF NOT EXISTS hospital_id TEXT DEFAULT 'grapevine'`;
  await sql`ALTER TABLE custom_cities ADD COLUMN IF NOT EXISTS hospital_id TEXT DEFAULT 'grapevine'`;
  await sql`ALTER TABLE city_aliases  ADD COLUMN IF NOT EXISTS hospital_id TEXT DEFAULT 'grapevine'`;
  // Seed this deployment's hospital so the hospitals table is never empty.
  // Reuses the same VITE_ branding vars set for the client, so one set of
  // env vars covers both — no separate server-side branding vars needed.
  const hospitalId = process.env.HOSPITAL_ID || 'grapevine';
  const hospitalName = process.env.VITE_HOSPITAL_NAME || 'Baylor Scott & White Medical Center — Grapevine';
  const hospitalTagline = process.env.VITE_HOSPITAL_TAGLINE || 'A Baylor Grapevine EMS Solution';
  const mapLat = Number(process.env.VITE_MAP_LAT) || 32.9339;
  const mapLon = Number(process.env.VITE_MAP_LON) || -97.0783;
  const mapZoom = Number(process.env.VITE_MAP_ZOOM) || 10;
  await sql`
    INSERT INTO hospitals (id, name, subtitle, lat, lon, map_zoom)
    VALUES (${hospitalId}, ${hospitalName}, ${hospitalTagline}, ${mapLat}, ${mapLon}, ${mapZoom})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getHospitalConfig(hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  const rows = await sql`SELECT * FROM hospitals WHERE id = ${hospitalId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAliases(hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  return sql`SELECT alias, canonical FROM city_aliases WHERE hospital_id = ${hospitalId} ORDER BY alias`;
}

export async function setAlias(alias, canonical, changeType = false, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`
    INSERT INTO city_aliases (alias, canonical, hospital_id)
    VALUES (${alias}, ${canonical}, ${hospitalId})
    ON CONFLICT (alias) DO UPDATE SET canonical = EXCLUDED.canonical
  `;
  if (changeType) {
    await sql`UPDATE transports SET city = ${canonical}, type = 'city' WHERE LOWER(city) = LOWER(${alias}) AND hospital_id = ${hospitalId}`;
  } else {
    await sql`UPDATE transports SET city = ${canonical} WHERE LOWER(city) = LOWER(${alias}) AND hospital_id = ${hospitalId}`;
  }
}

export async function deleteAlias(alias, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`DELETE FROM city_aliases WHERE LOWER(alias) = LOWER(${alias}) AND hospital_id = ${hospitalId}`;
}

export async function getTransports({ month, year, type = 'city', city }, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  // city search: return all entries for that city across the full year
  if (city) {
    return sql`
      SELECT * FROM transports
      WHERE year = ${+year}
        AND LOWER(city) = LOWER(${city})
        AND hospital_id = ${hospitalId}
      ORDER BY month ASC, created_at ASC
    `;
  }
  return sql`
    SELECT * FROM transports
    WHERE month = ${+month} AND year = ${+year}
      AND COALESCE(type, 'city') = ${type}
      AND hospital_id = ${hospitalId}
    ORDER BY created_at DESC
  `;
}

export async function getStats({ month, year, type = 'city' }, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  if (month) {
    return sql`
      SELECT MAX(city) AS city, MAX(county) AS county, SUM(transport_count)::int AS total
      FROM transports
      WHERE month = ${+month} AND year = ${+year}
        AND COALESCE(type, 'city') = ${type}
        AND hospital_id = ${hospitalId}
      GROUP BY LOWER(city) ORDER BY total DESC
    `;
  }
  return sql`
    SELECT MAX(city) AS city, MAX(county) AS county, SUM(transport_count)::int AS total
    FROM transports
    WHERE year = ${+year} AND COALESCE(type, 'city') = ${type}
      AND hospital_id = ${hospitalId}
    GROUP BY LOWER(city) ORDER BY total DESC
  `;
}

export async function getCityHistory(city, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  const rows = await sql`
    SELECT year, month, SUM(transport_count)::int AS total
    FROM transports
    WHERE LOWER(city) = LOWER(${city})
      AND COALESCE(type, 'city') = 'city'
      AND hospital_id = ${hospitalId}
    GROUP BY year, month
    ORDER BY year, month
  `;
  return rows.map(r => ({ year: +r.year, month: +r.month, total: +r.total }));
}

function normalizeCityName(name) {
  return name.trim().replace(/\S+/g, w => {
    // Preserve short all-caps abbreviations like DFW, NRH, EMS
    if (w.length <= 3 && w === w.toUpperCase()) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

export async function addTransport({ city, county, transport_count, month, year, type = 'city' }, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  const aliasRows = await sql`SELECT canonical FROM city_aliases WHERE LOWER(alias) = LOWER(${city}) AND hospital_id = ${hospitalId} LIMIT 1`;
  const resolvedCity = aliasRows.length ? aliasRows[0].canonical : city;
  const normalizedCity = normalizeCityName(resolvedCity);
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO transports (id, city, county, transport_count, month, year, type, hospital_id)
    VALUES (${id}, ${normalizedCity}, ${county ?? null}, ${+transport_count || 1}, ${+month}, ${+year}, ${type}, ${hospitalId})
    RETURNING *
  `;
  return rows[0];
}

export async function deleteTransport(id, hospitalId) {
  const sql = db();
  await initDB();
  await sql`DELETE FROM transports WHERE id = ${id} AND hospital_id = ${hospitalId}`;
}

export async function getCustomCities(hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  return sql`SELECT * FROM custom_cities WHERE hospital_id = ${hospitalId} ORDER BY city`;
}

export async function getMonthlyBreakdown(year, type = 'city', hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  return sql`
    SELECT MAX(city) AS city, month, SUM(transport_count)::int AS total
    FROM transports
    WHERE year = ${+year} AND COALESCE(type, 'city') = ${type}
      AND hospital_id = ${hospitalId}
    GROUP BY LOWER(city), month
    ORDER BY MAX(city), month
  `;
}

export async function upsertCustomCity({ city, county, lat, lon }, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`
    INSERT INTO custom_cities (city, county, lat, lon, hospital_id)
    VALUES (${city}, ${county ?? ''}, ${lat}, ${lon}, ${hospitalId})
    ON CONFLICT (city) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, county = EXCLUDED.county
  `;
}

export async function deleteCustomCity(city, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`DELETE FROM custom_cities WHERE LOWER(city) = LOWER(${city}) AND hospital_id = ${hospitalId}`;
}

export async function deleteAllByName(city, type, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`DELETE FROM transports WHERE LOWER(city) = LOWER(${city}) AND COALESCE(type,'city') = ${type} AND hospital_id = ${hospitalId}`;
}

export async function updateTransport(id, transport_count, hospitalId) {
  const sql = db();
  await initDB();
  const rows = await sql`
    UPDATE transports SET transport_count = ${+transport_count}
    WHERE id = ${id} AND hospital_id = ${hospitalId} RETURNING *
  `;
  return rows[0] ?? null;
}

export async function clearMonthData(month, year, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  await sql`DELETE FROM transports WHERE month = ${+month} AND year = ${+year} AND hospital_id = ${hospitalId}`;
}

export async function getExistingKeys(years, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  const uniqueYears = [...new Set(years.map(y => +y))];
  const results = await Promise.all(
    uniqueYears.map(y =>
      sql`SELECT LOWER(city) AS city, month, year, COALESCE(type,'city') AS type
          FROM transports WHERE year = ${y} AND hospital_id = ${hospitalId}`
    )
  );
  return new Set(results.flat().map(r => `${r.city}|${r.month}|${r.year}|${r.type}`));
}

export async function getYtdCompare({ throughMonth, compareYear, type = 'city' }, hospitalId = 'grapevine') {
  const sql = db();
  await initDB();
  const baseYear = +compareYear - 1;
  const rows = await sql`
    SELECT MAX(city) AS city, MAX(county) AS county, year, SUM(transport_count)::int AS total
    FROM transports
    WHERE year IN (${baseYear}, ${+compareYear})
      AND month <= ${+throughMonth}
      AND COALESCE(type, 'city') = ${type}
      AND hospital_id = ${hospitalId}
    GROUP BY LOWER(city), year
    ORDER BY MAX(city), year
  `;
  const map = {};
  for (const r of rows) {
    const key = r.city.toLowerCase();
    if (!map[key]) map[key] = { city: r.city, county: r.county, base: 0, compare: 0 };
    if (+r.year === baseYear) map[key].base = r.total;
    else { map[key].compare = r.total; map[key].city = r.city; }
  }
  return Object.values(map).sort((a, b) => b.compare - a.compare || b.base - a.base);
}
