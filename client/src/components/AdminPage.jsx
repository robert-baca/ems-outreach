import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import ManagePinsModal from './ManagePinsModal.jsx';

function HospitalsPanel() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', subtitle: '', address: '', lat: '', lon: '', map_zoom: '10' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin?resource=hospitals').then(r => r.json()).then(rows => {
      setHospitals(rows);
    }).catch(() => setError('Failed to load hospitals')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (h) => {
    setEditingId(h.id);
    setForm({ id: h.id, name: h.name, subtitle: h.subtitle || '', address: h.address || '', lat: h.lat ?? '', lon: h.lon ?? '', map_zoom: h.map_zoom ?? '10' });
    setError('');
  };

  const startNew = () => {
    setEditingId('__new__');
    setForm({ id: '', name: '', subtitle: '', address: '', lat: '', lon: '', map_zoom: '10' });
    setError('');
  };

  const cancel = () => { setEditingId(null); setError(''); };

  const save = async () => {
    if (!form.id.trim() || !form.name.trim()) { setError('ID and Name are required'); return; }
    setSaving(true);
    setError('');
    try {
      const resp = await apiFetch('/api/admin?resource=hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lat: form.lat !== '' ? parseFloat(form.lat) : null,
          lon: form.lon !== '' ? parseFloat(form.lon) : null,
          map_zoom: parseInt(form.map_zoom, 10) || 10,
        }),
      });
      if (!resp.ok) { const e = await resp.json(); setError(e.error || 'Save failed'); return; }
      setEditingId(null);
      load();
    } catch { setError('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3>Hospitals</h3>
        <button className="admin-btn primary" onClick={startNew}>+ New Hospital</button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? <div className="empty-state">Loading…</div> : (
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Subtitle</th><th>Center</th><th>Zoom</th><th></th></tr>
          </thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td><code>{h.id}</code></td>
                <td>{h.name}</td>
                <td className="admin-muted">{h.subtitle}</td>
                <td className="admin-muted">{h.lat != null ? `${h.lat}, ${h.lon}` : '—'}</td>
                <td className="admin-muted">{h.map_zoom}</td>
                <td><button className="admin-btn small" onClick={() => startEdit(h)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingId && (
        <div className="admin-form-backdrop" onClick={cancel}>
          <div className="admin-form" onClick={e => e.stopPropagation()}>
            <h4>{editingId === '__new__' ? 'New Hospital' : `Edit: ${editingId}`}</h4>
            {error && <div className="admin-error">{error}</div>}
            <label>ID (slug, no spaces)
              <input value={form.id} disabled={editingId !== '__new__'} maxLength={100}
                onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                placeholder="e.g. grapevine" />
            </label>
            <label>Hospital Name
              <input value={form.name} maxLength={200} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. BSW Medical Center — Grapevine" />
            </label>
            <label>Subtitle / Tagline
              <input value={form.subtitle} maxLength={200} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                placeholder="e.g. A Baylor Grapevine EMS Solution" />
            </label>
            <label>Address
              <input value={form.address} maxLength={300} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 1650 W College St, Grapevine, TX 76051" />
            </label>
            <div className="admin-form-row">
              <label>Latitude
                <input type="number" step="any" value={form.lat}
                  onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} placeholder="32.9339" />
              </label>
              <label>Longitude
                <input type="number" step="any" value={form.lon}
                  onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} placeholder="-97.0783" />
              </label>
              <label>Map Zoom
                <input type="number" min="5" max="15" value={form.map_zoom}
                  onChange={e => setForm(f => ({ ...f, map_zoom: e.target.value }))} />
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn" onClick={cancel}>Cancel</button>
              <button className="admin-btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage({ onClose, customCities, onPinsChange }) {
  const [tab, setTab] = useState('hospitals');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box admin-modal">
        <div className="modal-header">
          <h2>Admin</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab${tab === 'hospitals' ? ' active' : ''}`} onClick={() => setTab('hospitals')}>
            Hospitals
          </button>
          <button className={`admin-tab${tab === 'pins' ? ' active' : ''}`} onClick={() => setTab('pins')}>
            Map Pins
          </button>
        </div>

        <div className="admin-content">
          {tab === 'hospitals' ? (
            <HospitalsPanel />
          ) : (
            <ManagePinsModal customCities={customCities} onChange={onPinsChange} />
          )}
        </div>
      </div>
    </div>
  );
}
