import { useState, useEffect, useRef } from 'react';
import { DFW_CITIES, MONTHS } from '../cityData.js';

const SHORT = MONTHS.map(m => m.slice(0, 3));
const now = new Date();

function blankCounts() {
  return Array(12).fill('');
}

export default function QuickEntryModal({ month, year, onClose, onSave, customCities = [] }) {
  const [city, setCity] = useState('');
  const [type, setType] = useState('city');
  const [entryYear, setEntryYear] = useState(year);
  const [counts, setCounts] = useState(blankCounts);
  const [saving, setSaving] = useState(false);
  const [savedCity, setSavedCity] = useState(null);
  const cityInputRef = useRef(null);

  useEffect(() => {
    if (!savedCity) return;
    const t = setTimeout(() => setSavedCity(null), 4000);
    return () => clearTimeout(t);
  }, [savedCity]);

  const setCount = (i, val) =>
    setCounts(prev => { const next = [...prev]; next[i] = val; return next; });

  const filledRows = counts
    .map((c, i) => ({ month: i + 1, count: +c }))
    .filter(r => r.count > 0);

  const handleSave = async () => {
    if (!city.trim() || filledRows.length === 0) return;
    setSaving(true);
    try {
      await onSave(filledRows.map(r => ({
        city: city.trim(), count: r.count,
        month: r.month, year: +entryYear, type,
      })));
      setSavedCity(city.trim());
      setCity('');
      setCounts(blankCounts());
      cityInputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter' || e.key === 'Tab') return;
    if (e.key === 'ArrowRight' && i < 11) {
      e.preventDefault();
      document.getElementById(`qe-m-${i + 1}`)?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      document.getElementById(`qe-m-${i - 1}`)?.focus();
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal qe-modal">
        <div className="modal-header">
          <h2>Quick Entry</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="qe-body">
          {savedCity && (
            <div className="qe-saved-notice">✓ Saved {savedCity} — enter another city or close</div>
          )}

          <div className="qe-top-row">
            <div className="qe-field">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="qe-select">
                <option value="city">City</option>
                <option value="agency">Agency</option>
              </select>
            </div>
            <div className="qe-field qe-field-city">
              <label>City / Agency Name</label>
              <input
                ref={cityInputRef}
                list="qe-city-list"
                className="qe-city-input"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder={type === 'agency' ? 'Agency name…' : 'City name…'}
                autoFocus
                autoComplete="off"
              />
              <datalist id="qe-city-list">
                {DFW_CITIES.map(({ city }) => <option key={city} value={city} />)}
                {customCities
                  .filter(c => !DFW_CITIES.some(d => d.city.toLowerCase() === c.city.toLowerCase()))
                  .map(({ city }) => <option key={city} value={city} />)}
              </datalist>
            </div>
            <div className="qe-field">
              <label>Year</label>
              <input
                type="number" min={2020} max={2099}
                className="qe-year-input"
                value={entryYear}
                onChange={e => setEntryYear(e.target.value)}
              />
            </div>
          </div>

          <div className="qe-months-grid">
            {SHORT.map((m, i) => (
              <div key={m} className="qe-month-cell">
                <label className={`qe-month-label${i === month - 1 && +entryYear === year ? ' current' : ''}`}>
                  {m}
                </label>
                <input
                  id={`qe-m-${i}`}
                  type="number" min={0} max={9999}
                  className="qe-month-input"
                  value={counts[i]}
                  placeholder="—"
                  onChange={e => setCount(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, i)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-cancel" onClick={onClose}>Close</button>
          <button
            className="btn-import"
            disabled={!city.trim() || filledRows.length === 0 || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : `Save ${filledRows.length} month${filledRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
