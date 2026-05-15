import { useState, useEffect } from 'react';
import TransportForm from './TransportForm.jsx';
import GraphsTab from './GraphsTab.jsx';
import AiTab from './AiTab.jsx';
import { getColor } from './MapView.jsx';
import { MONTHS, DFW_CITIES } from '../cityData.js';
import { apiFetch } from '../api.js';

export default function Sidebar({
  stats, transports, agencyStats, agencyTransports,
  selectedCity, cityHistory, onClearCity,
  month, year, viewMode = 'month', onAdd, onDelete,
  customCities = [], onPinsChange, onRefresh,
}) {
  const [tab, setTab] = useState('add');
  const [agencyName, setAgencyName] = useState('');
  const [agencyCount, setAgencyCount] = useState(1);
  const [agencySubmitting, setAgencySubmitting] = useState(false);
  const [linkingCity, setLinkingCity]   = useState(null);
  const [linkTarget, setLinkTarget]     = useState('');
  const [linkBusy, setLinkBusy]         = useState(false);
  const [linkChangeType, setLinkChangeType] = useState(false);

  const builtInSet = new Set(DFW_CITIES.map(c => c.city.toLowerCase()));
  const customSet  = new Set(customCities.map(c => c.city.toLowerCase()));
  const onMapSet   = new Set([...builtInSet, ...customSet]);

  const allMapCities = [
    ...DFW_CITIES.map(c => c.city),
    ...customCities.map(c => c.city).filter(c => !builtInSet.has(c.toLowerCase())),
  ].sort();

  const startLink = (cityName, changeType = false) => {
    setLinkingCity(cityName);
    setLinkTarget('');
    setLinkChangeType(changeType);
  };

  const cancelLink = () => { setLinkingCity(null); setLinkTarget(''); };

  const handleLink = async () => {
    if (!linkingCity || !linkTarget.trim()) return;
    setLinkBusy(true);
    try {
      await apiFetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: linkingCity, canonical: linkTarget.trim(), changeType: linkChangeType }),
      });
      cancelLink();
      onRefresh?.();
    } finally {
      setLinkBusy(false);
    }
  };

  useEffect(() => {
    if (selectedCity) setTab('city');
  }, [selectedCity]);

  const handlePurge = async (city, type) => {
    if (!confirm(`Delete ALL records for "${city}" (${type})? This cannot be undone.`)) return;
    await apiFetch('/api/purge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, type }),
    });
    onRefresh?.();
  };

  const handleBack = () => {
    onClearCity();
    setTab('stats');
  };

  const totalTransports = stats.reduce((sum, s) => sum + s.total, 0);
  const totalAgency = agencyStats.reduce((sum, s) => sum + s.total, 0);

  const handleAgencyAdd = async (e) => {
    e.preventDefault();
    if (!agencyName.trim()) return;
    setAgencySubmitting(true);
    try {
      await onAdd({
        city: agencyName.trim(),
        county: null,
        transport_count: +agencyCount || 1,
        month,
        year,
        type: 'agency',
        knownCities: [],
      });
      setAgencyName('');
      setAgencyCount(1);
    } finally {
      setAgencySubmitting(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={tab === 'add'      ? 'active' : ''} onClick={() => setTab('add')}>Add</button>
        <button className={tab === 'stats'    ? 'active' : ''} onClick={() => setTab('stats')}>Cities ({stats.length})</button>
        <button className={tab === 'agencies' ? 'active' : ''} onClick={() => setTab('agencies')}>Agencies ({agencyStats.length})</button>
        <button className={tab === 'all'      ? 'active' : ''} onClick={() => setTab('all')}>All</button>
        <button className={tab === 'list'     ? 'active' : ''} onClick={() => setTab('list')}>Log</button>
        <button className={tab === 'graphs'   ? 'active' : ''} onClick={() => setTab('graphs')}>Graphs</button>
        <button className={tab === 'ai'       ? 'active' : ''} onClick={() => setTab('ai')}>Ask AI</button>
        {selectedCity && (
          <button className={tab === 'city' ? 'active' : ''} onClick={() => setTab('city')}
            style={{ color: '#1a365d', fontWeight: 800 }}>📍</button>
        )}
      </div>

      <div className="sidebar-content">
        {tab === 'add' && <TransportForm onAdd={onAdd} />}

        {tab === 'stats' && (
          <>
            <p className="stats-header">
              {viewMode === 'year' ? `${year} Full Year` : `${MONTHS[month - 1]} ${year}`} — {totalTransports} city transport{totalTransports !== 1 ? 's' : ''}
            </p>
            {linkingCity && (
              <LinkBar cityName={linkingCity} target={linkTarget} onTargetChange={setLinkTarget}
                allCities={allMapCities} busy={linkBusy} onSave={handleLink} onCancel={cancelLink}
                note={linkChangeType ? 'This will also move these records to city tracking and show them on the map.' : null} />
            )}
            {stats.length === 0 ? (
              <div className="empty-state">No city transports logged this month.</div>
            ) : (
              <ul className="stats-list">
                {stats.map((s, i) => {
                  const isOnMap = onMapSet.has(s.city.toLowerCase());
                  return (
                    <li key={s.city} className="stats-list-item" style={{ flexWrap: 'wrap', gap: 4 }}>
                      <span className="stats-rank">#{i + 1}</span>
                      <span className="stats-city">{s.city}</span>
                      <span className="stats-county">{s.county}</span>
                      <span className="stats-count"
                        style={{
                          background: getColor(s.total, viewMode === 'year') === '#e2e8f0' ? '#a0aec0' : getColor(s.total, viewMode === 'year'),
                          color: (viewMode === 'year' ? s.total > 180 : s.total > 15) ? '#fff' : '#2d3748',
                        }}>
                        {s.total}
                      </span>
                      {!isOnMap && (
                        <button className="link-badge" onClick={() => startLink(s.city, false)}
                          title="Not on map — click to link">
                          🔗 not on map
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {tab === 'agencies' && (
          <>
            <p className="stats-header">
              {viewMode === 'year' ? `${year} Full Year` : `${MONTHS[month - 1]} ${year}`} — {totalAgency} agency transport{totalAgency !== 1 ? 's' : ''}
            </p>

            <form className="agency-add-form" onSubmit={handleAgencyAdd}>
              <input
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                placeholder="Agency name (ACADIAN, CAREFLITE…)"
                required
                autoComplete="off"
              />
              <input
                type="number" min={1} max={999}
                value={agencyCount}
                onChange={e => setAgencyCount(e.target.value)}
                style={{ width: 64 }}
              />
              <button type="submit" className="btn-submit" disabled={agencySubmitting || !agencyName.trim()}>
                {agencySubmitting ? '…' : '+ Add'}
              </button>
            </form>

            {linkingCity && (
              <LinkBar cityName={linkingCity} target={linkTarget} onTargetChange={setLinkTarget}
                allCities={allMapCities} busy={linkBusy} onSave={handleLink} onCancel={cancelLink}
                note="This will move these records to city tracking and show them on the map." />
            )}
            {agencyStats.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 20 }}>No agency transports this month.</div>
            ) : (
              <ul className="stats-list" style={{ marginTop: 12 }}>
                {agencyStats.map((s, i) => (
                  <li key={s.city} className="stats-list-item" style={{ flexWrap: 'wrap', gap: 4 }}>
                    <span className="stats-rank">#{i + 1}</span>
                    <span className="stats-city">{s.city}</span>
                    <span className="stats-count" style={{ background: '#667eea', color: '#fff' }}>
                      {s.total}
                    </span>
                    <button className="link-badge link-badge-agency" onClick={() => startLink(s.city, true)}
                      title="Link to a city to show on map">
                      🗺 link to map
                    </button>
                    <button className="purge-btn" title="Delete all records for this agency"
                      onClick={() => handlePurge(s.city, 'agency')}>
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'all' && (() => {
          const combined = [
            ...stats.map(s => ({ ...s, kind: 'city' })),
            ...agencyStats.map(s => ({ ...s, kind: 'agency' })),
          ].sort((a, b) => b.total - a.total);
          const combinedTotal = combined.reduce((s, r) => s + r.total, 0);
          return (
            <>
              <p className="stats-header">
                {viewMode === 'year' ? `${year} Full Year` : `${MONTHS[month - 1]} ${year}`} — {combinedTotal} total transport{combinedTotal !== 1 ? 's' : ''}
              </p>
              {combined.length === 0 ? (
                <div className="empty-state">No transports logged.</div>
              ) : (
                <ul className="stats-list">
                  {combined.map((s, i) => (
                    <li key={`${s.kind}-${s.city}`} className="stats-list-item" style={{ flexWrap: 'wrap', gap: 4 }}>
                      <span className="stats-rank">#{i + 1}</span>
                      <span className="stats-city">{s.city}</span>
                      <span className="stats-count" style={{
                        background: s.kind === 'agency' ? '#667eea'
                          : getColor(s.total, viewMode === 'year') === '#e2e8f0' ? '#a0aec0'
                          : getColor(s.total, viewMode === 'year'),
                        color: '#fff',
                      }}>
                        {s.total}
                      </span>
                      <span className="all-type-badge" style={{ background: s.kind === 'agency' ? '#e9d8fd' : '#bee3f8', color: s.kind === 'agency' ? '#553c9a' : '#2b6cb0' }}>
                        {s.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()}

        {tab === 'list' && (
          <>
            <p className="stats-header" style={{ marginBottom: 12 }}>
              {MONTHS[month - 1]} {year} — all entries ({transports.length + agencyTransports.length})
            </p>
            {(transports.length + agencyTransports.length) === 0 ? (
              <div className="empty-state">No entries yet this month.</div>
            ) : (
              <div className="transport-list">
                {transports.map(t => <TransportCard key={t.id} t={t} label="city" onDelete={onDelete} />)}
                {agencyTransports.map(t => <TransportCard key={t.id} t={t} label="agency" onDelete={onDelete} />)}
              </div>
            )}
          </>
        )}

        {tab === 'graphs' && (
          <GraphsTab year={year} month={month} />
        )}

        {tab === 'ai' && (
          <AiTab stats={stats} agencyStats={agencyStats} month={month} year={year} viewMode={viewMode} />
        )}

        {tab === 'city' && (() => {
          if (!selectedCity) return <div className="empty-state">Click any dot on the map to see its history.</div>;
          const builtIn  = DFW_CITIES.find(c => c.city.toLowerCase() === selectedCity.toLowerCase());
          const custom   = customCities.find(c => c.city.toLowerCase() === selectedCity.toLowerCase());
          const coords   = builtIn ?? custom ?? null;
          const isCustom = !!custom && !builtIn;
          return (
            <CityDetail
              city={selectedCity} history={cityHistory} month={month} year={year} onBack={handleBack}
              coords={coords} isCustom={isCustom} onPinsChange={onPinsChange}
            />
          );
        })()}
      </div>
    </aside>
  );
}

function pctChange(current, prev) {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function StatCard({ label, value, sub, delta, highlight }) {
  const sign  = delta > 0 ? '▲' : delta < 0 ? '▼' : '●';
  const color = delta > 0 ? '#276749' : delta < 0 ? '#c53030' : '#b7791f';
  return (
    <div className={`stat-card${highlight ? ' stat-card-highlight' : ''}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub   && <div className="stat-card-sub">{sub}</div>}
      {delta != null && <div className="stat-card-delta" style={{ color }}>{sign} {Math.abs(delta)}%</div>}
    </div>
  );
}

function LinkBar({ cityName, target, onTargetChange, allCities, busy, onSave, onCancel, note }) {
  return (
    <div className="link-bar">
      <div className="link-bar-title">
        Link <strong>"{cityName}"</strong> to:
      </div>
      <div className="link-bar-row">
        <input
          list="link-datalist"
          value={target}
          onChange={e => onTargetChange(e.target.value)}
          placeholder="Type or pick a city…"
          onKeyDown={e => e.key === 'Enter' && onSave()}
          autoFocus
          className="link-bar-input"
        />
        <datalist id="link-datalist">
          {allCities.map(c => <option key={c} value={c} />)}
        </datalist>
        <button className="pin-btn pin-btn-primary" onClick={onSave} disabled={busy || !target.trim()}>
          {busy ? '…' : 'Link'}
        </button>
        <button className="pin-btn pin-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
      {note && <div className="link-bar-note">{note}</div>}
    </div>
  );
}

const NOMINATIM = name =>
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', Texas, USA')}&format=json&limit=1`;

function CityDetail({ city, history, month, year, onBack, coords, isCustom, onPinsChange }) {
  const maxTotal   = Math.max(...history.map(h => h.total), 1);
  const grandTotal = history.reduce((s, h) => s + h.total, 0);

  const current   = history.find(h => h.year === year  && h.month === month)?.total ?? 0;
  const ytd       = history.filter(h => h.year === year).reduce((s, h) => s + h.total, 0);
  const prevMonth = month === 1
    ? history.find(h => h.year === year - 1 && h.month === 12)?.total ?? null
    : history.find(h => h.year === year     && h.month === month - 1)?.total ?? null;
  const lastYear  = history.find(h => h.year === year - 1 && h.month === month)?.total ?? null;

  const prevMonthName = month === 1 ? `Dec ${year - 1}` : `${MONTHS[month - 2].slice(0, 3)} ${year}`;
  const lastYearLabel = `${MONTHS[month - 1].slice(0, 3)} ${year - 1}`;

  // Pin management state
  const [pinMode, setPinMode]         = useState(null); // null | 'connect' | 'edit'
  const [connectName, setConnectName] = useState('');
  const [editLat, setEditLat]         = useState('');
  const [editLon, setEditLon]         = useState('');
  const [pinBusy, setPinBusy]         = useState(false);
  const [pinMsg, setPinMsg]           = useState('');

  const startEdit = () => {
    setEditLat((+coords.lat).toFixed(5));
    setEditLon((+coords.lon).toFixed(5));
    setPinMode('edit');
    setPinMsg('');
  };

  const handleGeocode = async () => {
    setPinBusy(true); setPinMsg('');
    try {
      const data = await fetch(NOMINATIM(city), { headers: { 'Accept-Language': 'en' } }).then(r => r.json());
      if (!data.length) { setPinMsg('Location not found.'); return; }
      setEditLat(parseFloat(data[0].lat).toFixed(5));
      setEditLon(parseFloat(data[0].lon).toFixed(5));
    } finally { setPinBusy(false); }
  };

  const saveCoords = async () => {
    if (!editLat || !editLon) return;
    setPinBusy(true); setPinMsg('');
    try {
      await apiFetch('/api/cities/custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lat: +editLat, lon: +editLon }),
      });
      setPinMode(null);
      onPinsChange?.();
      setPinMsg('Location saved.');
    } finally { setPinBusy(false); }
  };

  const deletePin = async () => {
    if (!confirm(`Remove the "${city}" pin from the map?`)) return;
    setPinBusy(true);
    try {
      await apiFetch('/api/cities/custom', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      });
      onPinsChange?.();
      onBack();
    } finally { setPinBusy(false); }
  };

  const connectHere = async () => {
    if (!connectName.trim() || !coords) return;
    setPinBusy(true); setPinMsg('');
    try {
      await apiFetch('/api/cities/custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: connectName.trim(), lat: coords.lat, lon: coords.lon }),
      });
      setConnectName('');
      setPinMode(null);
      onPinsChange?.();
      setPinMsg(`"${connectName.trim()}" will now appear at this location.`);
    } finally { setPinBusy(false); }
  };

  return (
    <div className="city-detail">
      <button className="btn-back" onClick={onBack}>← Back to stats</button>
      <div className="city-detail-header">
        <h2 className="city-detail-name">{city}</h2>
        <div className="city-detail-total" style={{ background: '#1a365d', color: '#fff' }}>
          {grandTotal} all-time
        </div>
      </div>

      <div className="stat-cards">
        <StatCard label={`${MONTHS[month-1].slice(0,3)} ${year}`} value={current} sub="this month" highlight />
        <StatCard label="vs last month" value={prevMonth ?? '—'} sub={prevMonthName} delta={pctChange(current, prevMonth ?? 0)} />
        <StatCard label="vs last year"  value={lastYear  ?? '—'} sub={lastYearLabel}  delta={pctChange(current, lastYear  ?? 0)} />
        <StatCard label={`YTD ${year}`} value={ytd} sub={`Jan–${MONTHS[month-1].slice(0,3)}`} />
      </div>

      {history.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>No transport history yet for {city}.</div>
      ) : (
        <>
          <p className="city-detail-month">Month-to-month volume</p>
          <div className="history-chart">
            {history.map(({ year: hy, month: hm, total }) => {
              const BAR_MAX = 130;
              const barH = Math.max(4, Math.round((total / maxTotal) * BAR_MAX));
              const isActive = hy === year && hm === month;
              return (
                <div key={`${hy}-${hm}`} className={`history-col${isActive ? ' history-col-active' : ''}`}>
                  <span className="history-val">{total}</span>
                  <div className="history-bar-area">
                    <div className="history-bar" style={{
                      height: barH,
                      background: getColor(total) === '#e2e8f0' ? '#a0aec0' : getColor(total),
                      outline: isActive ? '2px solid #1a365d' : 'none',
                      outlineOffset: 1,
                    }} />
                  </div>
                  <span className="history-month">{MONTHS[hm - 1].slice(0, 3)}</span>
                  <span className="history-year">{hy}</span>
                </div>
              );
            })}
          </div>
          <table className="history-table">
            <thead><tr><th>Month</th><th>Year</th><th>Transports</th></tr></thead>
            <tbody>
              {[...history].reverse().map(({ year: hy, month: hm, total }) => (
                <tr key={`${hy}-${hm}`} style={hy === year && hm === month ? { background: '#ebf8ff' } : {}}>
                  <td>{MONTHS[hm - 1]}</td><td>{hy}</td><td><strong>{total}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Pin management ── */}
      <div className="city-pin-section">
        <div className="city-pin-header">
          <span className="city-pin-title">📍 Map pin</span>
          {coords && (
            <span className="city-pin-coords">
              {(+coords.lat).toFixed(4)}, {(+coords.lon).toFixed(4)}
            </span>
          )}
        </div>

        {pinMode === 'edit' && (
          <div className="city-pin-edit">
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" step="0.0001" value={editLat} onChange={e => setEditLat(e.target.value)}
                placeholder="Lat" style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
              <input type="number" step="0.0001" value={editLon} onChange={e => setEditLon(e.target.value)}
                placeholder="Lon" style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <button className="pin-btn pin-btn-secondary" onClick={handleGeocode} disabled={pinBusy}>
                {pinBusy ? '…' : '🔍 Re-locate'}
              </button>
              <button className="pin-btn pin-btn-primary" onClick={saveCoords} disabled={pinBusy}>Save</button>
              <button className="pin-btn pin-btn-secondary" onClick={() => setPinMode(null)}>Cancel</button>
              <button className="pin-btn pin-btn-danger" onClick={deletePin} disabled={pinBusy}>Delete pin</button>
            </div>
          </div>
        )}

        {pinMode === 'connect' && (
          <div className="city-pin-connect">
            <p style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>
              Any transport logged under this name will appear at <strong>{city}</strong>'s location on the map.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={connectName}
                onChange={e => setConnectName(e.target.value)}
                placeholder="e.g. MedStar, MSTAR…"
                onKeyDown={e => e.key === 'Enter' && connectHere()}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                autoFocus
              />
              <button className="pin-btn pin-btn-primary" onClick={connectHere} disabled={pinBusy || !connectName.trim()}>
                {pinBusy ? '…' : 'Add'}
              </button>
              <button className="pin-btn pin-btn-secondary" onClick={() => { setPinMode(null); setConnectName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {pinMode === null && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {coords && (
              <button className="pin-btn pin-btn-connect" onClick={() => { setPinMode('connect'); setPinMsg(''); }}>
                + Connect a name here
              </button>
            )}
            {isCustom && (
              <button className="pin-btn pin-btn-secondary" onClick={startEdit}>Edit location</button>
            )}
          </div>
        )}

        {pinMsg && (
          <div style={{ fontSize: 12, color: '#276749', marginTop: 6, padding: '4px 8px',
            background: '#f0fff4', borderRadius: 5, border: '1px solid #c6f6d5' }}>
            {pinMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function TransportCard({ t, label, onDelete }) {
  return (
    <div className="transport-card">
      <div className="transport-card-header">
        <div>
          <span className="transport-city">{t.city}</span>
          <span className="transport-type-badge" style={{ background: label === 'agency' ? '#667eea' : '#1a365d' }}>
            {label}
          </span>
        </div>
        <span className="transport-count-badge">{t.transport_count}</span>
      </div>
      <button className="btn-delete" title="Remove" onClick={() => onDelete(t.id)}>×</button>
    </div>
  );
}
