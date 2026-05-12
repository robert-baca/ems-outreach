import { getAliases, setAlias, deleteAlias } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await getAliases());
  }

  if (req.method === 'POST') {
    const { alias, canonical, changeType = false } = req.body;
    if (!alias || !canonical) return res.status(400).json({ error: 'alias and canonical required' });
    await setAlias(alias.trim(), canonical.trim(), changeType);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { alias } = req.body;
    if (!alias) return res.status(400).json({ error: 'alias required' });
    await deleteAlias(alias);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
