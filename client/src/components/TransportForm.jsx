import { useState } from 'react';
import { DFW_CITIES, MONTHS } from '../cityData.js';

const cityLookup = new Map(DFW_CITIES.map(({ city, county }) => [city.toLowerCase(), county]));
const now = new Date();

export default function TransportForm({ onAdd, customCities = [] }) {
  const [form, setForm] = useState({
    city: '',
    transport_count: 1,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const knownCities = DFW_CITIES.map(c => c.city);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = form.city.trim();
    if (!trimmed) return;

    const lowerCity = trimmed.toLowerCase();
    const county = cityLookup.get(lowerCity) ?? null;
    const isKnown =
      cityLookup.has(lowerCity) ||
      customCities.some(c => c.city.toLowerCase() === lowerCity);

    setSubmitting(true);
    if (!isKnown) setGeocoding(true);
    try {
      await onAdd({
        city: trimmed,
        county,
        transport_count: +form.transport_count || 1,
        month: +form.month,
        year: +form.year,
        knownCities,
      });
      setForm(f => ({ ...f, city: '', transport_count: 1 }));
    } finally {
      setSubmitting(false);
      setGeocoding(false);
    }
  };

  const customOnly = customCities.filter(c => !cityLookup.has(c.city.toLowerCase()));

  return (
    <form className="transport-form" onSubmit={handleSubmit}>
      <div className="form-row-2">
        <div className="form-group">
          <label>Month</label>
          <select value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Year</label>
          <input
            type="number"
            min={2020}
            max={2099}
            value={form.year}
            onChange={e => setForm(f => ({ ...f, year: +e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>City of Origin</label>
        <input
          list="city-list"
          value={form.city}
          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          placeholder="Type any city name…"
          required
          autoComplete="off"
        />
        <datalist id="city-list">
          {DFW_CITIES.map(({ city }) => <option key={city} value={city} />)}
          {customOnly.map(({ city }) => <option key={city} value={city} />)}
        </datalist>
      </div>

      <div className="form-group">
        <label>Transport Count</label>
        <input
          type="number"
          min={1}
          max={999}
          value={form.transport_count}
          onChange={e => setForm(f => ({ ...f, transport_count: e.target.value }))}
          required
        />
      </div>

      <button type="submit" className="btn-submit" disabled={submitting || !form.city.trim()}>
        {geocoding ? 'Locating city…' : submitting ? 'Saving…' : '+ Add'}
      </button>
    </form>
  );
}
