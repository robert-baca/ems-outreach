import { useState, useEffect } from 'react';
import { MONTHS } from '../cityData.js';

const COLORS = [
  '#1a365d', '#e53e3e', '#48bb78', '#ed8936', '#667eea',
  '#805ad5', '#319795', '#d69e2e', '#e91e8c', '#00897b',
];

const SHORT = MONTHS.map(m => m.slice(0, 3));

function OverallBarChart({ values, activeIndex }) {
  const max = Math.max(...values, 1);
  const W = 260, H = 90, PAD_L = 28, PAD_B = 18;
  const slot = (W - PAD_L) / 12;
  const barW = slot - 3;

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_B}`} style={{ width: '100%' }}>
      <line x1={PAD_L} y1={0} x2={PAD_L} y2={H} stroke="#e2e8f0" strokeWidth={1} />
      <line x1={PAD_L} y1={H} x2={W} y2={H} stroke="#e2e8f0" strokeWidth={1} />
      {values.map((v, i) => {
        const x = PAD_L + i * slot;
        const barH = v === 0 ? 2 : Math.max(3, Math.round((v / max) * H));
        const y = H - barH;
        const active = i === activeIndex;
        return (
          <g key={i}>
            <rect x={x + 1} y={y} width={barW} height={barH}
              fill={active ? '#1a365d' : '#667eea'} rx={2} opacity={active ? 1 : 0.72} />
            {v > 0 && (
              <text x={x + barW / 2 + 1} y={y - 2} textAnchor="middle" fontSize={6.5} fill="#4a5568">{v}</text>
            )}
            <text x={x + barW / 2 + 1} y={H + 13} textAnchor="middle"
              fontSize={7.5} fill={active ? '#1a365d' : '#a0aec0'} fontWeight={active ? 700 : 400}>
              {SHORT[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MultiLineChart({ cityMonthly, cities }) {
  const allVals = cities.flatMap(c => cityMonthly[c] || []);
  const max = Math.max(...allVals, 1);
  const W = 260, H = 130, PAD_L = 28, PAD_B = 16, PAD_T = 6;
  const xStep = (W - PAD_L) / 11;

  const yFor = v => PAD_T + H - (v / max) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_B + PAD_T}`} style={{ width: '100%' }}>
      {[0.25, 0.5, 0.75, 1].map(frac => (
        <line key={frac} x1={PAD_L} x2={W} y1={yFor(max * frac)} y2={yFor(max * frac)}
          stroke="#f0f0f0" strokeWidth={1} />
      ))}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H + PAD_T} stroke="#e2e8f0" strokeWidth={1} />
      <line x1={PAD_L} y1={H + PAD_T} x2={W} y2={H + PAD_T} stroke="#e2e8f0" strokeWidth={1} />

      {cities.map((city, ci) => {
        const vals = cityMonthly[city] || Array(12).fill(0);
        const color = COLORS[ci % COLORS.length];
        const pts = vals.map((v, i) => `${PAD_L + i * xStep},${yFor(v)}`).join(' ');
        return (
          <g key={city}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8}
              strokeLinejoin="round" strokeLinecap="round" />
            {vals.map((v, i) => v > 0 && (
              <circle key={i} cx={PAD_L + i * xStep} cy={yFor(v)} r={2.5} fill={color} />
            ))}
          </g>
        );
      })}

      {SHORT.map((m, i) => (
        <text key={m} x={PAD_L + i * xStep} y={H + PAD_T + 12}
          textAnchor="middle" fontSize={7} fill="#a0aec0">{m}</text>
      ))}

      <text x={PAD_L - 2} y={yFor(max)} textAnchor="end" fontSize={6.5} fill="#a0aec0">{max}</text>
      <text x={PAD_L - 2} y={yFor(max * 0.5)} textAnchor="end" fontSize={6.5} fill="#a0aec0">
        {Math.round(max * 0.5)}
      </text>
    </svg>
  );
}

function YoyView({ year, month }) {
  const [cityRows, setCityRows] = useState([]);
  const [agencyRows, setAgencyRows] = useState([]);
  const [type, setType] = useState('city');
  const [loading, setLoading] = useState(false);
  const baseYear = year - 1;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/ytd-compare?compareYear=${year}&throughMonth=${month}&type=city`).then(r => r.json()),
      fetch(`/api/ytd-compare?compareYear=${year}&throughMonth=${month}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      setCityRows(city);
      setAgencyRows(agency);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [year, month]);

  const rows = type === 'city' ? cityRows : agencyRows;
  const baseTotal = rows.reduce((s, r) => s + r.base, 0);
  const compareTotal = rows.reduce((s, r) => s + r.compare, 0);
  const netChange = compareTotal - baseTotal;
  const pct = baseTotal > 0 ? Math.round((netChange / baseTotal) * 100) : null;

  const maxVal = Math.max(...rows.flatMap(r => [r.base, r.compare]), 1);
  const BAR_MAX_W = 120;

  const periodLabel = `Jan–${SHORT[month - 1]}`;

  return (
    <div className="yoy-view">
      <div className="graphs-type-toggle">
        <button className={`graphs-type-btn${type === 'city' ? ' active' : ''}`} onClick={() => setType('city')}>Cities</button>
        <button className={`graphs-type-btn agency${type === 'agency' ? ' active' : ''}`} onClick={() => setType('agency')}>Agencies</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No data to compare for {year}.</div>
      ) : (
        <>
          <div className="yoy-summary">
            <div className="yoy-summary-block yoy-base">
              <span className="yoy-summary-year">{baseYear} YTD</span>
              <span className="yoy-summary-val">{baseTotal.toLocaleString()}</span>
              <span className="yoy-summary-period">{periodLabel}</span>
            </div>
            <div className="yoy-summary-arrow">
              <span className={`yoy-change-badge ${netChange > 0 ? 'positive' : netChange < 0 ? 'negative' : 'neutral'}`}>
                {netChange > 0 ? '+' : ''}{netChange.toLocaleString()}
                {pct !== null && <span className="yoy-pct"> ({pct > 0 ? '+' : ''}{pct}%)</span>}
              </span>
            </div>
            <div className="yoy-summary-block yoy-compare">
              <span className="yoy-summary-year">{year} YTD</span>
              <span className="yoy-summary-val">{compareTotal.toLocaleString()}</span>
              <span className="yoy-summary-period">{periodLabel}</span>
            </div>
          </div>

          <div className="yoy-legend-row">
            <span className="yoy-legend-swatch" style={{ background: '#a0aec0' }} /><span>{baseYear}</span>
            <span className="yoy-legend-swatch" style={{ background: '#1a365d', marginLeft: 12 }} /><span>{year}</span>
          </div>

          <div className="yoy-table">
            {rows.map(r => {
              const rowPct = r.base > 0 ? Math.round(((r.compare - r.base) / r.base) * 100) : null;
              const isUp = r.compare > r.base;
              const isDown = r.compare < r.base;
              return (
                <div key={r.city} className="yoy-row">
                  <div className="yoy-row-name">{r.city}</div>
                  <div className="yoy-bars">
                    <div className="yoy-bar-group">
                      <div className="yoy-bar-base" style={{ width: `${(r.base / maxVal) * BAR_MAX_W}px` }} />
                      <span className="yoy-bar-label">{r.base || ''}</span>
                    </div>
                    <div className="yoy-bar-group">
                      <div className="yoy-bar-compare" style={{ width: `${(r.compare / maxVal) * BAR_MAX_W}px` }} />
                      <span className="yoy-bar-label">{r.compare || ''}</span>
                    </div>
                  </div>
                  <div className={`yoy-delta ${isUp ? 'up' : isDown ? 'down' : ''}`}>
                    {isUp ? '+' : ''}{r.compare - r.base}
                    {rowPct !== null && <span className="yoy-delta-pct"> ({rowPct > 0 ? '+' : ''}{rowPct}%)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function GraphsTab({ year, month }) {
  const [cityData, setCityData] = useState([]);
  const [agencyData, setAgencyData] = useState([]);
  const [type, setType] = useState('city');
  const [view, setView] = useState('trends');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/trends?year=${year}&type=city`).then(r => r.json()),
      fetch(`/api/trends?year=${year}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      setCityData(city);
      setAgencyData(agency);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [year]);

  const data = type === 'city' ? cityData : agencyData;

  const cityTotals = {};
  data.forEach(({ city, total }) => { cityTotals[city] = (cityTotals[city] || 0) + total; });
  const topCities = Object.entries(cityTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([city]) => city);

  const monthlyTotals = Array.from({ length: 12 }, (_, i) =>
    data.reduce((sum, row) => row.month === i + 1 ? sum + row.total : sum, 0)
  );

  const cityMonthly = {};
  topCities.forEach(city => {
    cityMonthly[city] = Array.from({ length: 12 }, (_, i) => {
      const row = data.find(r => r.city === city && r.month === i + 1);
      return row?.total || 0;
    });
  });

  const yearTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const peakIdx = monthlyTotals.indexOf(Math.max(...monthlyTotals));

  return (
    <div className="graphs-tab">
      <div className="graphs-view-toggle">
        <button className={`graphs-view-btn${view === 'trends' ? ' active' : ''}`} onClick={() => setView('trends')}>
          Trends
        </button>
        <button className={`graphs-view-btn${view === 'yoy' ? ' active' : ''}`} onClick={() => setView('yoy')}>
          Year vs Year
        </button>
      </div>

      {view === 'yoy' ? (
        <YoyView year={year} month={month} />
      ) : (
        <>
          <div className="graphs-type-toggle">
            <button className={`graphs-type-btn${type === 'city' ? ' active' : ''}`} onClick={() => setType('city')}>Cities</button>
            <button className={`graphs-type-btn agency${type === 'agency' ? ' active' : ''}`} onClick={() => setType('agency')}>Agencies</button>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : data.length === 0 ? (
            <div className="empty-state">No {type} data for {year}.</div>
          ) : (
            <>
              <div className="graphs-summary">
                <div className="graphs-summary-item">
                  <span className="graphs-summary-val">{yearTotal.toLocaleString()}</span>
                  <span className="graphs-summary-lbl">{year} total</span>
                </div>
                <div className="graphs-summary-item">
                  <span className="graphs-summary-val">{monthlyTotals[month - 1] || 0}</span>
                  <span className="graphs-summary-lbl">{SHORT[month - 1]} volume</span>
                </div>
                <div className="graphs-summary-item">
                  <span className="graphs-summary-val">{SHORT[peakIdx]}</span>
                  <span className="graphs-summary-lbl">peak month</span>
                </div>
              </div>

              <p className="stats-header" style={{ marginBottom: 4 }}>Monthly totals — {year}</p>
              <OverallBarChart values={monthlyTotals} activeIndex={month - 1} />

              {topCities.length > 1 && (
                <>
                  <p className="stats-header" style={{ marginTop: 14, marginBottom: 4 }}>
                    Top {topCities.length} — month by month
                  </p>
                  <MultiLineChart cityMonthly={cityMonthly} cities={topCities} />
                  <div className="graphs-legend">
                    {topCities.map((city, i) => (
                      <div key={city} className="graphs-legend-item">
                        <div className="graphs-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        <span>{city}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="stats-header" style={{ marginTop: 14, marginBottom: 4 }}>All departments</p>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Dept</th>
                    {SHORT.map(m => <th key={m}>{m}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topCities.map((city, ci) => (
                    <tr key={city}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[ci % COLORS.length], flexShrink: 0 }} />
                        {city}
                      </td>
                      {cityMonthly[city].map((v, i) => (
                        <td key={i} style={{ textAlign: 'center', background: i === month - 1 ? '#ebf8ff' : undefined }}>
                          {v || ''}
                        </td>
                      ))}
                      <td><strong>{cityTotals[city]}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
