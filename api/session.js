import { verifySessionToken, COOKIE_NAME } from './_pinauth.js';

export default async function handler(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  res.json({ authenticated: verifySessionToken(token) });
}
