import { deleteTransport } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  await deleteTransport(req.query.id);
  res.json({ success: true });
}
