import { getHospitalId } from './_hospital.js';

// Resolves hospitalId and sends 401 if unauthenticated.
// Usage: const hospitalId = await requireAuth(req, res); if (!hospitalId) return;
export async function requireAuth(req, res) {
  const hospitalId = await getHospitalId(req);
  if (!hospitalId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return hospitalId;
}
