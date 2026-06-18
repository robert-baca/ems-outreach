import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'eo_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is not set');
  return s;
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

export function createSessionToken() {
  const payload = `authenticated.${Date.now() + MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [marker, expiresAtRaw, signature] = parts;
  const expected = sign(`${marker}.${expiresAtRaw}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return marker === 'authenticated';
}

export function checkPin(candidate) {
  const expected = process.env.SITE_PIN;
  if (!expected) throw new Error('SITE_PIN environment variable is not set');
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
