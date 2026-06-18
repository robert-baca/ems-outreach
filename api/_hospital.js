import { verifySessionToken, COOKIE_NAME } from './_pinauth.js';

// Single-tenant deployment: anyone with a valid PIN session belongs to the
// hospital this deployment is configured for (one Vercel project per hospital).
export async function getHospitalId(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!verifySessionToken(token)) return null;
  return process.env.HOSPITAL_ID || 'grapevine';
}
