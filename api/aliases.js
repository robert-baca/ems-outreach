import { getAliases, setAlias, deleteAlias } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  if (req.method === 'GET') {
    return res.json(await getAliases(hospitalId));
  }

  if (req.method === 'POST') {
    const { alias, canonical, changeType = false } = req.body;
    if (!alias || !canonical) return res.status(400).json({ error: 'alias and canonical required' });
    await setAlias(alias.trim(), canonical.trim(), changeType, hospitalId);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { alias } = req.body;
    if (!alias) return res.status(400).json({ error: 'alias required' });
    await deleteAlias(alias, hospitalId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
