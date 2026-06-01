import { deleteTransport, updateTransport } from '../_db.js';
import { requireAuth } from '../_auth.js';

export default async function handler(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  if (req.method === 'DELETE') {
    await deleteTransport(req.query.id);
    return res.json({ success: true });
  }

  if (req.method === 'PUT') {
    const { transport_count } = req.body;
    if (!transport_count || +transport_count < 1)
      return res.status(400).json({ error: 'transport_count required' });
    const updated = await updateTransport(req.query.id, +transport_count);
    if (!updated) return res.status(404).json({ error: 'not found' });
    return res.json(updated);
  }

  res.status(405).end();
}
