import { useState, useEffect } from 'react';
import TransportForm from './TransportForm.jsx';
import { getColor } from './MapView.jsx';
import { MONTHS } from '../cityData.js';

export default function Sidebar({
  stats, transports, selectedCity, cityHistory, onClearCity,
  month, year, onAdd, onDelete,
}) {
  const [tab, setTab] = useState('add');

  useEffect(() => {
    if (selectedCity) setTab('city');
  }, [selectedCity]);

  const handleBack = () => {
    onClearCity();
    setTab('stats');
  };

  const totalTransports = stats.reduce((sum, s) => sum + s.total, 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={tab === 'add'   ? 'active' : ''} onClick={() => setTab('add')}>Add</button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>Stats ({stats.length})</button>
        <button className={tab === 'list'  ? 'active' : ''} onClick={() => setTab('list')}>Log ({transports.length})</button>
        {selectedCity && (
          <button className={tab === 'city' ? 'active' : ''} onClick={() => setTab('city')}
            style={{ color: '#1a365d', fontWeight: 800 }}>📍</button>
        )}
      </div>

      <div className="sidebar-content">
        {tab === 'add' && (
          <TransportForm onAdd={onAdd} />
        )}

        {tab === 'stats' && (
          <>
            <p className="stats-header">
              {MONTHS[month - 1]} {year} — {totalTransports} total transport{totalTransports !== 1 ? 's' : ''}
            </p>
            {stats.length === 0 ? (
              <div className="empty-state">No transports logged this month.</div>
            ) : (
              <ul className="stats-list">
                {stats.map((s, i) => (
                  <li key={s.city} className="stats-list-item">
                    <span className="stats-rank">#{i + 1}</span>
                    <span className="stats-city">{s.city}</span>
                    <span className="stats-county">{s.county}</span>
                    <span className="stats-count"
                      style={{
                        background: getColor(s.total) === '#e2e8f0' ? '#a0aec0' : getColor(s.total),
                        color: s.total > 15 ? '#fff' : '#2d3748',
                      }}>
                      {s.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'list' && (
          <>
            <p className="stats-header" style={{ marginBottom: 12 }}>
              {MONTHS[month - 1]} {year} — transport log
            </p>
            {transports.length === 0 ? (
              <div className="empty-state">No entries yet this month.</div>
            ) : (
              <div className="transport-list">
                {transports.map(t => <TransportCard key={t.id} t={t} onDelete={onDelete} />)}
              </div>
            )}
          </>
        )}

        {tab === 'city' && (
          selectedCity
            ? <CityDetail city={selectedCity} history={cityHistory} month={month} year={year} onBack={handleBack} />
            : <div className="empty-state">Click any dot on the map to see its history.</div>
        )}
      </div>
    </aside>
  );
}

function pctChange(current, prev) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct;
}

function StatCard({ label, value, sub, delta, highlight }) {
  const sign = delta > 0 ? '▲' : delta < 0 ? '▼' : '●';
  const color = delta > 0 ? '#276749' : delta < 0 ? '#c53030' : '#b7791f';

  return (
    <div className={`stat-card${highlight ? ' stat-card-highlight' : ''}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
      {delta != null && (
        <div className="stat-card-delta" style={{ color }}>
          {sign} {Math.abs(delta)}%
        </div>
      )}
    </div>
  );
}

function CityDetail({ city, history, month, year, onBack }) {
  const maxTotal  = Math.max(...history.map(h => h.total), 1);
  const grandTotal = history.reduce((s, h) => s + h.total, 0);

  // Current month
  const current = history.find(h => h.year === year && h.month === month)?.total ?? 0;

  // YTD (all months in selected year)
  const ytd = history.filter(h => h.year === year).reduce((s, h) => s + h.total, 0);

  // Month-over-month
  const prevMonth = month === 1
    ? history.find(h => h.year === year - 1 && h.month === 12)?.total ?? null
    : history.find(h => h.year === year && h.month === month - 1)?.total ?? null;
  const momDelta = prevMonth != null ? pctChange(current, prevMonth) : null;

  // Month-over-year (same month, prior year)
  const lastYear = history.find(h => h.year === year - 1 && h.month === month)?.total ?? null;
  const moyDelta = lastYear != null ? pctChange(current, lastYear) : null;

  const prevMonthName = month === 1 ? `Dec ${year - 1}` : `${MONTHS[month - 2].slice(0, 3)} ${year}`;
  const lastYearLabel = `${MONTHS[month - 1].slice(0, 3)} ${year - 1}`;

  return (
    <div className="city-detail">
      <button className="btn-back" onClick={onBack}>← Back to stats</button>

      <div className="city-detail-header">
        <h2 className="city-detail-name">{city}</h2>
        <div className="city-detail-total" style={{ background: '#1a365d', color: '#fff' }}>
          {grandTotal} all-time
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-cards">
        <StatCard
          label={`${MONTHS[month - 1].slice(0, 3)} ${year}`}
          value={current}
          sub="this month"
          highlight
        />
        <StatCard
          label="vs last month"
          value={prevMonth ?? '—'}
          sub={prevMonthName}
          delta={momDelta}
        />
        <StatCard
          label="vs last year"
          value={lastYear ?? '—'}
          sub={lastYearLabel}
          delta={moyDelta}
        />
        <StatCard
          label={`YTD ${year}`}
          value={ytd}
          sub={`Jan–${MONTHS[month - 1].slice(0, 3)}`}
        />
      </div>

      {history.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          No transport history yet for {city}.
        </div>
      ) : (
        <>
          <p className="city-detail-month">Month-to-month volume</p>
          <div className="history-chart">
            {history.map(({ year: hy, month: hm, total }) => (
              <div
                key={`${hy}-${hm}`}
                className={`history-col${hy === year && hm === month ? ' history-col-active' : ''}`}
              >
                <span className="history-val">{total}</span>
                <div className="history-bar-wrap">
                  <div
                    className="history-bar"
                    style={{
                      height: `${Math.max(4, Math.round((total / maxTotal) * 100))}%`,
                      background: getColor(total) === '#e2e8f0' ? '#a0aec0' : getColor(total),
                    }}
                  />
                </div>
                <span className="history-month">{MONTHS[hm - 1].slice(0, 3)}</span>
                <span className="history-year">{hy}</span>
              </div>
            ))}
          </div>

          <table className="history-table">
            <thead>
              <tr><th>Month</th><th>Year</th><th>Transports</th></tr>
            </thead>
            <tbody>
              {[...history].reverse().map(({ year: hy, month: hm, total }) => (
                <tr key={`${hy}-${hm}`}
                  style={hy === year && hm === month ? { background: '#ebf8ff' } : {}}>
                  <td>{MONTHS[hm - 1]}</td>
                  <td>{hy}</td>
                  <td><strong>{total}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function TransportCard({ t, onDelete }) {
  return (
    <div className="transport-card">
      <div className="transport-card-header">
        <span className="transport-city">{t.city}</span>
        <span className="transport-count-badge">{t.transport_count}</span>
      </div>
      <button className="btn-delete" title="Remove" onClick={() => onDelete(t.id)}>×</button>
    </div>
  );
}
