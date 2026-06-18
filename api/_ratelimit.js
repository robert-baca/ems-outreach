import { neon } from '@neondatabase/serverless';

function db() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS rate_limit_events (
    id SERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

// Durable (DB-backed) rate limit so counts survive serverless cold starts.
// Returns true if the action is allowed, false if the bucket is over its limit.
export async function checkRateLimit(bucket, { max, windowMs }) {
  const sql = db();
  await ensureTable(sql);

  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM rate_limit_events
    WHERE bucket = ${bucket} AND created_at > ${windowStart}
  `;
  if (count >= max) return false;

  await sql`INSERT INTO rate_limit_events (bucket) VALUES (${bucket})`;
  if (Math.random() < 0.05) {
    await sql`DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '1 day'`;
  }
  return true;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
