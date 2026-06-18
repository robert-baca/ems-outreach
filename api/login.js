import { checkPin, createSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from './_pinauth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`login:${ip}`, { max: LOGIN_MAX, windowMs: LOGIN_WINDOW_MS });
    if (!allowed) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }

    const { pin } = req.body || {};
    if (typeof pin !== 'string' || !checkPin(pin)) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${createSessionToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
