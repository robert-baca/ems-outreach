import { useState } from 'react';
import { DFW_CITIES, MONTHS } from '../cityData.js';

const now = new Date();

function makeRow(month, year) {
  return { id: Math.random(), city: '', count: 1, month, year, type: 'city' };
}

export default function QuickEntryModal({ month, year, onClose, onSave }) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: 6 }, () => makeRow(month, year))
  );
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(null);

  const update = (id, field, value) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r));

  const addRow = () => setRows(rs => [...rs, makeRow(month, year)]);
  const removeRow = (id) => setRows(rs => rs.filter(r => r.id !== id));

  const validRows = rows.filter(r => r.city.trim() && +r.count > 0 && r.month && r.year);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(validRows);
      setSavedCount(validRows.length);
    } finally {
      setSaving(false);
    }
  };

  if (savedCount !== null) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 380, textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ fontWeight: 700, fontSize: 18, marginTop: 12 }}>
            {savedCount} record{savedCount !== 1 ? 's' : ''} saved
          </p>
          <button className="btn-import" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal qe-modal">
        <div className="modal-header">
          <h2>Quick Entry</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="qe-table-wrap">
          <table className="qe-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>City / Agency Name</th>
                <th>Count</th>
                <th>Month</th>
                <th>Year</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td>
                    <select
                      className="qe-type"
                      value={row.type}
                      onChange={e => update(row.id, 'type', e.target.value)}
                    >
                      <option value="city">City</option>
                      <option value="agency">Agency</option>
                    </select>
                  </td>
                  <td>
                    <input
                      list="qe-city-list"
                      className="qe-city"
                      value={row.city}
                      onChange={e => update(row.id, 'city', e.target.value)}
                      placeholder={row.type === 'agency' ? 'Agency name…' : 'City name…'}
                      autoFocus={i === 0}
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <input
                      type="number" min={1} max={999}
                      className="qe-count"
                      value={row.count}
                      onChange={e => update(row.id, 'count', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="qe-month"
                      value={row.month}
                      onChange={e => update(row.id, 'month', +e.target.value)}
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m.slice(0, 3)}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number" min={2020} max={2099}
                      className="qe-year"
                      value={row.year}
                      onChange={e => update(row.id, 'year', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="qe-remove"
                      onClick={() => removeRow(row.id)}
                      tabIndex={-1}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="qe-city-list">
            {DFW_CITIES.map(({ city }) => <option key={city} value={city} />)}
          </datalist>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn-add-row" onClick={addRow}>+ Add row</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button
              className="btn-import"
              disabled={validRows.length === 0 || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : `Save ${validRows.length} row${validRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
