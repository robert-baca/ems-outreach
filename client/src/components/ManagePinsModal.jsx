import { useState } from 'react';

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
    <tr className="pin-edit-row">
      <td>
        <input
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="Name on map"
          disabled={!isNew}
          style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 13 }}
        />
      </td>
      <td>
        <input type="number" step="0.0001" value={lat} onChange={e => setLat(e.target.value)}
          placeholder="32.7555"
          style={{ width: 90, padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12 }} />
      </td>
      <td>
        <input type="number" step="0.0001" value={lon} onChange={e => setLon(e.target.value)}
          placeholder="-97.3308"
          style={{ width: 90, padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12 }} />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={handleGeocode} disabled={busy || !city.trim()}
            style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 5,
              background: '#f7fafc', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {busy ? '…' : '🔍 Locate'}
          </button>
          <button onClick={handleSave} disabled={busy}
            style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 5,
              background: '#1a365d', color: '#fff', cursor: 'pointer' }}>
            Save
          </button>
          <button onClick={onCancel}
            style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 5,
              background: '#fff', cursor: 'pointer' }}>
            Cancel
          </button>
          {!isNew && (
            <button onClick={onDelete} disabled={busy}
              style={{ padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 5,
                background: '#fff3f3', color: '#e53e3e', cursor: 'pointer' }}>
              Delete
            </button>
          )}
        </div>
        {err && <div style={{ color: '#e53e3e', fontSize: 11, marginTop: 3 }}>{err}</div>}
      </td>
    </tr>
  );
}

export default function ManagePinsModal({ customCities, onClose, onChange }) {
  const [editing, setEditing] = useState(null); // city name being edited, or '__new__'
  const [pins, setPins]       = useState(customCities);

  const refresh = async () => {
    const data = await fetch('/api/cities').then(r => r.json());
    setPins(data);
    onChange(data);
  };

  const handleSave = async (row) => {
    await fetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
    setEditing(null);
    await refresh();
  };

  const handleDelete = async (cityName) => {
    if (!confirm(`Remove "${cityName}" from the map?`)) return;
    await fetch('/api/cities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: cityName }),
    });
    setEditing(null);
    await refresh();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>Manage Map Pins</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ overflowX: 'auto' }}>
          <p style={{ fontSize: 13, color: '#718096', marginBottom: 12 }}>
            Custom pins override auto-geocoding. Use this to fix a city location or add an agency with a known address (e.g. MedStar → Fort Worth).
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={th}>Name</th>
                <th style={th}>Lat</th>
                <th style={th}>Lon</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pins.map(pin => (
                editing === pin.city
                  ? <EditRow key={pin.city} pin={pin}
                      onSave={handleSave}
                      onDelete={() => handleDelete(pin.city)}
                      onCancel={() => setEditing(null)} />
                  : (
                    <tr key={pin.city} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={td}><strong>{pin.city}</strong></td>
                      <td style={td}>{(+pin.lat).toFixed(4)}</td>
                      <td style={td}>{(+pin.lon).toFixed(4)}</td>
                      <td style={td}>
                        <button onClick={() => setEditing(pin.city)}
                          style={{ padding: '3px 10px', fontSize: 12, border: '1px solid #e2e8f0',
                            borderRadius: 5, background: '#fff', cursor: 'pointer' }}>
                          Edit
                        </button>
                      </td>
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
            <div className="empty-state" style={{ padding: '20px 0' }}>No custom pins yet.</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-submit"
            onClick={() => setEditing('__new__')}
            disabled={!!editing}
            style={{ marginRight: 'auto' }}>
            + Add Pin
          </button>
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.4px', color: '#718096',
  borderBottom: '2px solid #e2e8f0' };
const td = { padding: '8px 10px', verticalAlign: 'middle' };
