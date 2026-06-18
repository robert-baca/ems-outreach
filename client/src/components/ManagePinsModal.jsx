import { useState } from 'react';
import { apiFetch } from '../api.js';

const GEOCODE_URL = city =>
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', Texas, USA')}&format=json&limit=1`;

async function geocode(name) {
  const res = await fetch(GEOCODE_URL(name), { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Could not locate "${name}"`);
  return { lat: +parseFloat(data[0].lat).toFixed(5), lon: +parseFloat(data[0].lon).toFixed(5) };
}

function EditRow({ pin, onSave, onDelete, onCancel, isNew }) {
  const [city, setCity]     = useState(pin.city || '');
  const [lat, setLat]       = useState(pin.lat ?? '');
  const [lon, setLon]       = useState(pin.lon ?? '');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  const handleGeocode = async () => {
    if (!city.trim()) return;
    setBusy(true); setErr('');
    try {
      const coords = await geocode(city.trim());
      setLat(coords.lat);
      setLon(coords.lon);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!city.trim() || !lat || !lon) { setErr('Name, lat, and lon are all required.'); return; }
    setBusy(true); setErr('');
    try {
      await onSave({ city: city.trim(), lat: +lat, lon: +lon });
    } catch (e) {
      setErr('Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <input className="admin-select" value={city} onChange={e => setCity(e.target.value)}
          placeholder="Name on map" disabled={!isNew} />
      </td>
      <td>
        <input className="admin-select" type="number" step="0.0001" value={lat}
          onChange={e => setLat(e.target.value)} placeholder="32.7555" style={{ width: 90 }} />
      </td>
      <td>
        <input className="admin-select" type="number" step="0.0001" value={lon}
          onChange={e => setLon(e.target.value)} placeholder="-97.3308" style={{ width: 90 }} />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="admin-btn small" onClick={handleGeocode} disabled={busy || !city.trim()}>
            {busy ? '…' : '🔍 Locate'}
          </button>
          <button className="admin-btn small primary" onClick={handleSave} disabled={busy}>Save</button>
          <button className="admin-btn small" onClick={onCancel}>Cancel</button>
          {!isNew && (
            <button className="admin-btn small" onClick={onDelete} disabled={busy}
              style={{ color: '#e53e3e' }}>
              Delete
            </button>
          )}
        </div>
        {err && <div className="admin-error" style={{ marginTop: 4 }}>{err}</div>}
      </td>
    </tr>
  );
}

export default function ManagePinsModal({ customCities, onClose, onChange }) {
  const [editing, setEditing] = useState(null); // city name being edited, or '__new__'
  const [pins, setPins]       = useState(customCities);

  const refresh = async () => {
    const data = await apiFetch('/api/cities').then(r => r.json());
    setPins(data);
    onChange(data);
  };

  const handleSave = async (row) => {
    await apiFetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
    setEditing(null);
    await refresh();
  };

  const handleDelete = async (cityName) => {
    if (!confirm(`Remove "${cityName}" from the map?`)) return;
    await apiFetch('/api/cities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: cityName }),
    });
    setEditing(null);
    await refresh();
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3>Map Pins</h3>
        <button className="admin-btn primary" onClick={() => setEditing('__new__')} disabled={!!editing}>
          + Add Pin
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#718096', margin: '0 0 12px' }}>
        Custom pins override auto-geocoding. Use this to fix a city location or add an agency with a known address (e.g. MedStar → Fort Worth).
      </p>

      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Lat</th><th>Lon</th><th></th></tr>
        </thead>
        <tbody>
          {pins.map(pin => (
            editing === pin.city
              ? <EditRow key={pin.city} pin={pin}
                  onSave={handleSave}
                  onDelete={() => handleDelete(pin.city)}
                  onCancel={() => setEditing(null)} />
              : (
                <tr key={pin.city}>
                  <td><strong>{pin.city}</strong></td>
                  <td className="admin-muted">{(+pin.lat).toFixed(4)}</td>
                  <td className="admin-muted">{(+pin.lon).toFixed(4)}</td>
                  <td><button className="admin-btn small" onClick={() => setEditing(pin.city)}>Edit</button></td>
                </tr>
              )
          ))}

          {editing === '__new__' && (
            <EditRow pin={{ city: '', lat: '', lon: '' }} isNew
              onSave={handleSave}
              onCancel={() => setEditing(null)} />
          )}
        </tbody>
      </table>

      {pins.length === 0 && editing !== '__new__' && (
        <div className="empty-state">No custom pins yet.</div>
      )}
    </div>
  );
}
