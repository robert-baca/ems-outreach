import { verifySessionToken, COOKIE_NAME } from './_pinauth.js';

// Single-tenant deployment: anyone with a valid PIN session is "grapevine".
export async function getHospitalId(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!verifySessionToken(token)) return null;
  return 'grapevine';
}
