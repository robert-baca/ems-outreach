import { useState, useEffect, useRef } from 'react';
import { MONTHS } from '../cityData.js';
import { apiFetch } from '../api.js';

const SHORT = MONTHS.map(m => m.slice(0, 3));

const DEFAULT_SECTIONS = {
  statCards:       true,
  cityRankings:    true,
  growthArrows:    true,
  agencyBreakdown: true,
  monthlyTrend:    true,
  topMovers:       false,
  momChanges:      false,
  yoyComparison:   false,
};

const SECTION_LABELS = {
  statCards:       'Stat Cards',
  cityRankings:    'City Rankings',
  growthArrows:    'Growth Arrows on Cities',
  agencyBreakdown: 'Agency Breakdown',
  monthlyTrend:    'Monthly Trend Chart',
  topMovers:       'Top Movers (▲▼ vs last month)',
  momChanges:      'Month-over-Month Table',
  yoyComparison:   'Year-over-Year Comparison',
};

// ── Multi-select city picker ──────────────────────────────────────────
function CityPicker({ label, allCities, includes, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isAll     = includes === null;
  const isChecked = (city) => includes === null || includes.has(city);
  const count     = includes === null ? allCities.length : includes.size;

  const toggle = (city) => {
    if (includes === null) {
      // Go from "all" to explicit set minus this city
      const next = new Set(allCities.filter(c => c !== city));
      onChange(next.size === 0 ? null : next);
    } else {
      const next = new Set(includes);
      if (next.has(city)) {
        next.delete(city);
        if (next.size === 0) return; // prevent empty
      } else {
        next.add(city);
      }
      onChange(next.size === allCities.length ? null : next);
    }
  };

  return (
    <div className="report-picker" ref={ref}>
      <button className={`report-picker-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {label}: {isAll ? 'All' : `${count} of ${allCities.length}`} ▾
      </button>
      {open && (
        <div className="report-picker-panel">
          <div className="report-picker-actions">
            <button onClick={() => onChange(null)}>Select All</button>
            <button onClick={() => onChange(new Set([allCities[0]]))}>Clear</button>
          </div>
          <div className="report-picker-list">
            {allCities.map(city => (
              <label key={city} className="report-picker-item">
                <input type="checkbox" checked={isChecked(city)} onChange={() => toggle(city)} />
                <span>{city}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function ExportModal({ stats, prevStats, prevAgencyStats = [], agencyStats, month, year, viewMode, hospitalConfig, onClose }) {
  const [sections, setSections]       = useState(DEFAULT_SECTIONS);
  const [monthlyTotals, setMonthlyTotals] = useState(Array(12).fill(0));
  const [yoyData, setYoyData]         = useState([]);
  const [cityIncludes, setCityIncludes] = useState(null);   // null = all
  const [yoyIncludes, setYoyIncludes]   = useState(null);   // null = all

  const toggle = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/trends?year=${year}&type=city`).then(r => r.json()),
      apiFetch(`/api/trends?year=${year}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      const totals = Array(12).fill(0);
      [...city, ...agency].forEach(r => { if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += r.total; });
      setMonthlyTotals(totals);
    }).catch(() => {});

    apiFetch(`/api/trends?mode=ytd&compareYear=${year}&throughMonth=${month}&type=city`)
      .then(r => r.json()).then(setYoyData).catch(() => {});
  }, [year, month]);

  const isYear          = viewMode === 'year';
  const isYearInProgress = isYear && year === new Date().getFullYear();
  const period       = isYear
    ? (isYearInProgress ? `Year-to-Date ${year} (Jan–${SHORT[new Date().getMonth()]})` : `Full Year ${year}`)
    : `${MONTHS[month - 1]} ${year}`;
  const hospitalName = hospitalConfig?.name ?? 'Baylor Scott & White Medical Center — Grapevine';

  const cityTotal       = stats.reduce((s, r) => s + r.total, 0);
  const agencyTotal     = agencyStats.reduce((s, r) => s + r.total, 0);
  const grandTotal      = cityTotal + agencyTotal;
  const prevCityTotal   = prevStats.reduce((s, r) => s + r.total, 0);
  const prevAgencyTotal = prevAgencyStats.reduce((s, r) => s + r.total, 0);
  const prevGrandTotal  = prevCityTotal + prevAgencyTotal;
  const momPct          = prevGrandTotal > 0 ? Math.round(((grandTotal - prevGrandTotal) / prevGrandTotal) * 100) : null;
  const ytd             = monthlyTotals.slice(0, month).reduce((s, v) => s + v, 0);
  const maxCity         = stats[0]?.total || 1;
  const maxAgency       = agencyStats[0]?.total || 1;
  const maxBar          = Math.max(...monthlyTotals, 1);

  // MoM per-city
  const prevMap = new Map(prevStats.map(s => [s.city.toLowerCase(), s.total]));
  const cityMoM = stats.map(s => {
    const prev = prevMap.get(s.city.toLowerCase()) ?? 0;
    const pct  = prev > 0 ? Math.round(((s.total - prev) / prev) * 100) : null;
    return { ...s, prev, changePct: pct };
  });

  // Apply city filter
  const filteredCityMoM = cityIncludes === null
    ? cityMoM
    : cityMoM.filter(s => cityIncludes.has(s.city));

  // Apply YoY filter
  const filteredYoy = yoyIncludes === null
    ? yoyData
    : yoyData.filter(r => yoyIncludes.has(r.city));

  // Top movers from full unfiltered list
  const withChange = cityMoM.filter(s => s.changePct !== null && s.changePct !== 0);
  const gainers    = [...withChange].filter(s => s.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  const decliners  = [...withChange].filter(s => s.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 3);

  const prevMonthLabel = month === 1 ? `Dec ${year - 1}` : `${MONTHS[month - 2]} ${year}`;
  const generatedOn    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // City name lists for pickers
  const allCityNames = stats.map(s => s.city);
  const allYoyCities = yoyData.map(r => r.city);

  return (
    <div className="report-overlay">

      {/* Controls */}
      <div className="report-controls no-print">
        <button className="report-print-btn" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="report-close-btn" onClick={onClose}>✕ Close</button>
      </div>

      {/* Section toggles */}
      <div className="report-options no-print">
        <div className="report-options-title">Report Sections</div>
        <div className="report-options-grid">
          {Object.entries(SECTION_LABELS).map(([key, label]) => (
            <label key={key} className={`report-option-btn${sections[key] ? ' on' : ''}`}>
              <input type="checkbox" checked={sections[key]} onChange={() => toggle(key)} style={{ display: 'none' }} />
              <span className="report-option-check">{sections[key] ? '✓' : '+'}</span> {label}
            </label>
          ))}
        </div>

        {/* City / dept pickers — shown when relevant sections are on */}
        {(sections.cityRankings || sections.momChanges) && allCityNames.length > 0 && (
          <div className="report-picker-row">
            <span className="report-picker-label">Filter City Rankings:</span>
            <CityPicker
              label="Cities"
              allCities={allCityNames}
              includes={cityIncludes}
              onChange={setCityIncludes}
            />
          </div>
        )}
        {sections.yoyComparison && allYoyCities.length > 0 && (
          <div className="report-picker-row">
            <span className="report-picker-label">Filter Year-over-Year:</span>
            <CityPicker
              label="Departments"
              allCities={allYoyCities}
              includes={yoyIncludes}
              onChange={setYoyIncludes}
            />
          </div>
        )}
      </div>

      {/* ── Report page ── */}
      <div className="report-page">

        {/* Header */}
        <div className="report-header">
          <div className="report-header-left">
            <span className="report-header-icon">🏥</span>
            <div>
              <div className="report-title">EMS Outreach Report</div>
              <div className="report-subtitle">{hospitalName}</div>
            </div>
          </div>
          <div className="report-period-badge">{period}</div>
        </div>

        {/* Stat cards */}
        {sections.statCards && (
          <div className="report-stats-row">
            <div className="report-stat-card report-stat-primary">
              <div className="report-stat-label">Total Transports</div>
              <div className="report-stat-value">{grandTotal.toLocaleString()}</div>
              <div className="report-stat-sub">{cityTotal.toLocaleString()} city · {agencyTotal.toLocaleString()} agency</div>
            </div>
            {!isYear && momPct !== null && (
              <div className="report-stat-card">
                <div className="report-stat-label">vs Last Month</div>
                <div className={`report-stat-value report-delta ${momPct > 0 ? 'up' : momPct < 0 ? 'down' : ''}`}>
                  {momPct > 0 ? '▲' : momPct < 0 ? '▼' : '●'} {Math.abs(momPct)}%
                </div>
                <div className="report-stat-sub">{grandTotal.toLocaleString()} vs {prevGrandTotal.toLocaleString()} prior (all transports)</div>
              </div>
            )}
            {!isYear && (
              <div className="report-stat-card">
                <div className="report-stat-label">YTD {year}</div>
                <div className="report-stat-value">{ytd.toLocaleString()}</div>
                <div className="report-stat-sub">Jan–{SHORT[month - 1]}</div>
              </div>
            )}
            <div className="report-stat-card">
              <div className="report-stat-label">#1 City</div>
              <div className="report-stat-value report-stat-city">{stats[0]?.city ?? '—'}</div>
              <div className="report-stat-sub">{(stats[0]?.total ?? 0).toLocaleString()} transports</div>
            </div>
            <div className="report-stat-card">
              <div className="report-stat-label">Cities Served</div>
              <div className="report-stat-value">{stats.length}</div>
              <div className="report-stat-sub">{agencyStats.length} agencies</div>
            </div>
          </div>
        )}

        {/* Top Movers */}
        {sections.topMovers && (gainers.length > 0 || decliners.length > 0) && (
          <div className="report-movers">
            {gainers.length > 0 && (
              <div className="report-movers-col">
                <div className="report-movers-header up">📈 Top Gainers vs Last Month</div>
                {gainers.map(s => (
                  <div key={s.city} className="report-mover-row">
                    <span className="report-mover-city">{s.city}</span>
                    <span className="report-mover-arrow up">▲ {s.changePct}%</span>
                    <span className="report-mover-vals">{s.prev} → {s.total}</span>
                  </div>
                ))}
              </div>
            )}
            {decliners.length > 0 && (
              <div className="report-movers-col">
                <div className="report-movers-header down">📉 Top Decliners vs Last Month</div>
                {decliners.map(s => (
                  <div key={s.city} className="report-mover-row">
                    <span className="report-mover-city">{s.city}</span>
                    <span className="report-mover-arrow down">▼ {Math.abs(s.changePct)}%</span>
                    <span className="report-mover-vals">{s.prev} → {s.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="report-body">
          {sections.cityRankings && (
            <div className="report-col-left">
              <div className="report-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>City Transport Volume</span>
                {sections.growthArrows && <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a0aec0' }}>▲▼ = vs prior month</span>}
              </div>
              <table className="report-rank-table">
                <tbody>
                  {filteredCityMoM.map((s, i) => (
                    <tr key={s.city}>
                      <td className="report-rank-num">#{i + 1}</td>
                      <td className="report-rank-name">
                        {s.city}
                        {sections.growthArrows && s.changePct !== null && s.changePct !== 0 && (
                          <span className={`report-growth-arrow ${s.changePct > 0 ? 'up' : 'down'}`}>
                            {s.changePct > 0 ? `▲${s.changePct}%` : `▼${Math.abs(s.changePct)}%`}
                          </span>
                        )}
                      </td>
                      <td className="report-rank-bar">
                        <div className="report-bar-track">
                          <div className="report-bar-fill report-bar-city"
                            style={{ width: `${Math.round((s.total / maxCity) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="report-rank-val">{s.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="report-col-right">
            {sections.agencyBreakdown && agencyStats.length > 0 && (
              <div className="report-agencies-block">
                <div className="report-section-title">Agency Breakdown</div>
                <table className="report-rank-table">
                  <tbody>
                    {agencyStats.slice(0, 8).map((s, i) => (
                      <tr key={s.city}>
                        <td className="report-rank-num">#{i + 1}</td>
                        <td className="report-rank-name">{s.city}</td>
                        <td className="report-rank-bar">
                          <div className="report-bar-track">
                            <div className="report-bar-fill report-bar-agency"
                              style={{ width: `${Math.round((s.total / maxAgency) * 100)}%` }} />
                          </div>
                        </td>
                        <td className="report-rank-val">{s.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sections.monthlyTrend && (
              <div className="report-trend-block">
                <div className="report-section-title">{year} Monthly Volume</div>
                <div className="report-trend-bars">
                  {monthlyTotals.map((v, i) => {
                    const barH    = v > 0 ? Math.max(6, Math.round((v / maxBar) * 64)) : 3;
                    const isCur   = isYearInProgress ? i === new Date().getMonth() : i === month - 1;
                    const isFuture = isYearInProgress ? i > new Date().getMonth() : (i > month - 1 && !isYear);
                    return (
                      <div key={i} className="report-trend-col">
                        {v > 0 && <span className="report-trend-val">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</span>}
                        <div className="report-trend-bar-wrap">
                          <div className="report-trend-bar" style={{
                            height: barH,
                            background: isFuture ? '#e2e8f0' : isCur ? '#1a365d' : '#667eea',
                            opacity: isFuture ? 0.4 : 1,
                          }} />
                        </div>
                        <span className="report-trend-month"
                          style={{ color: isCur ? '#1a365d' : '#a0aec0', fontWeight: isCur ? 700 : 400 }}>
                          {SHORT[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MoM table */}
        {sections.momChanges && !isYear && (
          <div className="report-full-section">
            <div className="report-section-title">
              Month-over-Month — {MONTHS[month - 1]} {year} vs {prevMonthLabel}
            </div>
            <table className="report-wide-table">
              <thead>
                <tr><th>City</th><th>{prevMonthLabel}</th><th>{MONTHS[month - 1]} {year}</th><th>Change</th><th>%</th></tr>
              </thead>
              <tbody>
                {filteredCityMoM.filter(s => s.total > 0 || s.prev > 0).map(s => {
                  const diff = s.total - s.prev;
                  return (
                    <tr key={s.city}>
                      <td className="report-wide-city">{s.city}</td>
                      <td className="report-wide-num">{s.prev || '—'}</td>
                      <td className="report-wide-num"><strong>{s.total}</strong></td>
                      <td className={`report-wide-num ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                        {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                      </td>
                      <td className={`report-wide-num ${(s.changePct ?? 0) > 0 ? 'up' : (s.changePct ?? 0) < 0 ? 'down' : ''}`}>
                        {s.changePct !== null ? `${s.changePct > 0 ? '+' : ''}${s.changePct}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* YoY table */}
        {sections.yoyComparison && filteredYoy.length > 0 && (
          <div className="report-full-section">
            <div className="report-section-title">
              Year-over-Year — Jan–{SHORT[month - 1]} {year - 1} vs {year}
            </div>
            <table className="report-wide-table">
              <thead>
                <tr><th>City</th><th>{year - 1} YTD</th><th>{year} YTD</th><th>Change</th><th>%</th></tr>
              </thead>
              <tbody>
                {filteredYoy.map(r => {
                  const diff   = r.compare - r.base;
                  const pctChg = r.base > 0 ? Math.round((diff / r.base) * 100) : null;
                  return (
                    <tr key={r.city}>
                      <td className="report-wide-city">{r.city}</td>
                      <td className="report-wide-num">{r.base || '—'}</td>
                      <td className="report-wide-num"><strong>{r.compare || '—'}</strong></td>
                      <td className={`report-wide-num ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                        {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                      </td>
                      <td className={`report-wide-num ${(pctChg ?? 0) > 0 ? 'up' : (pctChg ?? 0) < 0 ? 'down' : ''}`}>
                        {pctChg !== null ? `${pctChg > 0 ? '+' : ''}${pctChg}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="report-footer">
          Generated {generatedOn} · EMS Outreach · {hospitalName}
        </div>
      </div>
    </div>
  );
}
