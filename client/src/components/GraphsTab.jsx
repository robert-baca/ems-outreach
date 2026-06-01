import { useState, useEffect } from 'react';
import { MONTHS } from '../cityData.js';
import { apiFetch } from '../api.js';

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
  const throughMonth = Math.max(1, month - 1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/trends?mode=ytd&compareYear=${year}&throughMonth=${throughMonth}&type=city`).then(r => r.json()),
      apiFetch(`/api/trends?mode=ytd&compareYear=${year}&throughMonth=${throughMonth}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      setCityRows(city);
      setAgencyRows(agency);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [year, throughMonth]);

  const rows = type === 'all'
    ? (() => {
        const map = {};
        [...cityRows, ...agencyRows].forEach(r => {
          if (!map[r.city]) map[r.city] = { city: r.city, county: r.county, base: 0, compare: 0 };
          map[r.city].base += r.base;
          map[r.city].compare += r.compare;
        });
        return Object.values(map).sort((a, b) => b.compare - a.compare || b.base - a.base);
      })()
    : type === 'city' ? cityRows : agencyRows;
  const baseTotal = rows.reduce((s, r) => s + r.base, 0);
  const compareTotal = rows.reduce((s, r) => s + r.compare, 0);
  const netChange = compareTotal - baseTotal;
  const pct = baseTotal > 0 ? Math.round((netChange / baseTotal) * 100) : null;

  const maxVal = Math.max(...rows.flatMap(r => [r.base, r.compare]), 1);
  const BAR_MAX_W = 120;

  const periodLabel = `Jan–${SHORT[throughMonth - 1]}`;

  return (
    <div className="yoy-view">
      <div className="graphs-type-toggle">
        <button className={`graphs-type-btn${type === 'city' ? ' active' : ''}`} onClick={() => setType('city')}>Cities</button>
        <button className={`graphs-type-btn agency${type === 'agency' ? ' active' : ''}`} onClick={() => setType('agency')}>Agencies</button>
        <button className={`graphs-type-btn${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>All</button>
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

const YEAR_COLORS = ['#1a365d', '#e53e3e', '#48bb78', '#ed8936', '#805ad5'];

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth(); // 0-indexed current month; months > this are future

function MultiYearLineChart({ yearData, years }) {
  const allVals = years.flatMap((y, yi) => {
    const vals = yearData[y] || [];
    return y === CUR_YEAR ? vals.slice(0, CUR_MONTH + 1) : vals;
  });
  const max = Math.max(...allVals, 1);
  const W = 260, H = 110, PAD_L = 30, PAD_B = 16, PAD_T = 6;
  const xStep = (W - PAD_L) / 11;
  const yFor = v => PAD_T + H - (v / max) * H;
  const cutX = PAD_L + (CUR_MONTH + 1) * xStep;

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_B + PAD_T}`} style={{ width: '100%' }}>
      {/* future months shading */}
      {years.includes(CUR_YEAR) && (
        <rect x={cutX} y={PAD_T} width={W - cutX} height={H} fill="#f7fafc" opacity={0.7} />
      )}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={PAD_L} x2={W} y1={yFor(max * f)} y2={yFor(max * f)} stroke="#f0f0f0" strokeWidth={1} />
      ))}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H + PAD_T} stroke="#e2e8f0" strokeWidth={1} />
      <line x1={PAD_L} y1={H + PAD_T} x2={W} y2={H + PAD_T} stroke="#e2e8f0" strokeWidth={1} />
      {/* "today" cutoff line */}
      {years.includes(CUR_YEAR) && (
        <line x1={cutX} y1={PAD_T} x2={cutX} y2={H + PAD_T}
          stroke="#a0aec0" strokeWidth={1} strokeDasharray="3 2" />
      )}
      {years.map((y, yi) => {
        const vals = yearData[y] || Array(12).fill(0);
        const color = YEAR_COLORS[yi % YEAR_COLORS.length];
        const drawVals = y === CUR_YEAR ? vals.map((v, i) => i <= CUR_MONTH ? v : 0) : vals;
        const pts = drawVals.map((v, i) => `${PAD_L + i * xStep},${yFor(v)}`).join(' ');
        return (
          <g key={y}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
            {drawVals.map((v, i) => v > 0 && (
              <circle key={i} cx={PAD_L + i * xStep} cy={yFor(v)} r={2.5} fill={color} />
            ))}
          </g>
        );
      })}
      {SHORT.map((m, i) => (
        <text key={m} x={PAD_L + i * xStep} y={H + PAD_T + 12}
          textAnchor="middle" fontSize={7}
          fill={years.includes(CUR_YEAR) && i > CUR_MONTH ? '#d0d0d0' : '#a0aec0'}>{m}</text>
      ))}
      <text x={PAD_L - 2} y={yFor(max)} textAnchor="end" fontSize={6.5} fill="#a0aec0">{max}</text>
      <text x={PAD_L - 2} y={yFor(max * 0.5)} textAnchor="end" fontSize={6.5} fill="#a0aec0">{Math.round(max * 0.5)}</text>
    </svg>
  );
}

function MultiYearView() {
  const currentYear = new Date().getFullYear();
  const [years, setYears] = useState([currentYear - 2, currentYear - 1, currentYear]);
  const [type, setType] = useState('city');
  const [yearData, setYearData] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchYear = (y, t) => {
    if (t === 'all') {
      return Promise.all([
        apiFetch(`/api/trends?year=${y}&type=city`).then(r => r.json()),
        apiFetch(`/api/trends?year=${y}&type=agency`).then(r => r.json()),
      ]).then(([city, agency]) => {
        const monthly = Array(12).fill(0);
        [...city, ...agency].forEach(r => { if (r.month >= 1 && r.month <= 12) monthly[r.month - 1] += r.total; });
        return [y, monthly];
      });
    }
    return apiFetch(`/api/trends?year=${y}&type=${t}`)
      .then(r => r.json())
      .then(rows => {
        const monthly = Array(12).fill(0);
        rows.forEach(r => { if (r.month >= 1 && r.month <= 12) monthly[r.month - 1] += r.total; });
        return [y, monthly];
      });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all(years.map(y => fetchYear(y, type)))
      .then(results => {
        const d = {};
        results.forEach(([y, m]) => { d[y] = m; });
        setYearData(d);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [years, type]);

  const toggleYear = (y) => {
    setYears(prev =>
      prev.includes(y) ? (prev.length > 1 ? prev.filter(x => x !== y) : prev)
                       : [...prev, y].sort()
    );
  };

  const yearTotals = years.map(y => ({
    year: y,
    total: (yearData[y] || []).reduce((s, v, i) => {
      if (y === CUR_YEAR && i > CUR_MONTH) return s;
      return s + v;
    }, 0),
  }));

  const delta = (a, b) => {
    if (!a || !b) return null;
    const diff = b - a;
    const pct = a > 0 ? Math.round((diff / a) * 100) : null;
    return { diff, pct };
  };

  return (
    <div className="multiyear-view">
      <div className="graphs-type-toggle" style={{ marginBottom: 8 }}>
        <button className={`graphs-type-btn${type === 'city' ? ' active' : ''}`} onClick={() => setType('city')}>Cities</button>
        <button className={`graphs-type-btn agency${type === 'agency' ? ' active' : ''}`} onClick={() => setType('agency')}>Agencies</button>
        <button className={`graphs-type-btn${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>All</button>
      </div>

      <div className="multiyear-year-picker">
        {Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map(y => (
          <button
            key={y}
            className={`multiyear-year-btn${years.includes(y) ? ' active' : ''}`}
            style={years.includes(y) ? { background: YEAR_COLORS[years.indexOf(y) % YEAR_COLORS.length], borderColor: YEAR_COLORS[years.indexOf(y) % YEAR_COLORS.length] } : {}}
            onClick={() => toggleYear(y)}
          >{y}</button>
        ))}
      </div>

      {loading ? <div className="empty-state">Loading…</div> : (
        <>
          <div className="multiyear-legend">
            {years.map((y, i) => (
              <span key={y} className="multiyear-legend-item">
                <span className="multiyear-legend-dot" style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                {y}: <strong>{(yearData[y] || []).reduce((s, v) => s + v, 0).toLocaleString()}</strong>
              </span>
            ))}
          </div>

          <MultiYearLineChart yearData={yearData} years={years} />

          <table className="multiyear-table">
            <thead>
              <tr>
                <th>Month</th>
                {years.map(y => <th key={y} style={{ color: YEAR_COLORS[years.indexOf(y) % YEAR_COLORS.length] }}>{y}</th>)}
                {years.length >= 2 && years.slice(0, -1).map((y, i) => (
                  <th key={`d${y}`} className="multiyear-delta-head">{y}→{years[i + 1]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, mi) => {
                const isFuture = (y) => y === CUR_YEAR && mi > CUR_MONTH;
                const vals = years.map(y => isFuture(y) ? null : ((yearData[y] || [])[mi] || 0));
                return (
                  <tr key={m} style={mi > CUR_MONTH && years.includes(CUR_YEAR) ? { opacity: 0.4 } : {}}>
                    <td className="multiyear-month">{SHORT[mi]}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="multiyear-val">{v === null ? <em style={{color:'#ccc'}}>future</em> : v || '—'}</td>
                    ))}
                    {years.length >= 2 && vals.slice(0, -1).map((v, i) => {
                      const d = delta(v, vals[i + 1]);
                      if (!d || v === null || vals[i + 1] === null || (v === 0 && vals[i + 1] === 0)) return <td key={i} className="multiyear-delta" />;
                      return (
                        <td key={i} className={`multiyear-delta ${d.diff > 0 ? 'up' : d.diff < 0 ? 'down' : ''}`}>
                          {d.diff > 0 ? '+' : ''}{d.diff}
                          {d.pct !== null && <span className="multiyear-delta-pct"> ({d.pct > 0 ? '+' : ''}{d.pct}%)</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="multiyear-total-row">
                <td>Total</td>
                {yearTotals.map(({ year: y, total }) => (
                  <td key={y} className="multiyear-val"><strong>{total.toLocaleString()}</strong></td>
                ))}
                {years.length >= 2 && yearTotals.slice(0, -1).map(({ total: a }, i) => {
                  const b = yearTotals[i + 1].total;
                  const d = delta(a, b);
                  if (!d) return <td key={i} />;
                  return (
                    <td key={i} className={`multiyear-delta ${d.diff > 0 ? 'up' : d.diff < 0 ? 'down' : ''}`}>
                      <strong>{d.diff > 0 ? '+' : ''}{d.diff.toLocaleString()}</strong>
                      {d.pct !== null && <span className="multiyear-delta-pct"> ({d.pct > 0 ? '+' : ''}{d.pct}%)</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CUR_YEAR - 3 + i);

export default function GraphsTab({ year, month }) {
  const [cityData, setCityData] = useState([]);
  const [agencyData, setAgencyData] = useState([]);
  const [type, setType] = useState('city');
  const [view, setView] = useState('trends');
  const [loading, setLoading] = useState(false);
  const [trendsYear, setTrendsYear] = useState(year);

  useEffect(() => { setTrendsYear(year); }, [year]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/trends?year=${trendsYear}&type=city`).then(r => r.json()),
      apiFetch(`/api/trends?year=${trendsYear}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      setCityData(city);
      setAgencyData(agency);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [trendsYear]);

  const rawData = type === 'all'
    ? [...cityData, ...agencyData]
    : type === 'city' ? cityData : agencyData;

  // Merge rows with the same city name (case-insensitive) and month so
  // GRAPEVINE and Grapevine don't appear as two separate chart series.
  const dataMap = {};
  for (const row of rawData) {
    const key = `${row.city.toLowerCase()}|${row.month}`;
    if (!dataMap[key]) {
      dataMap[key] = { ...row };
    } else {
      dataMap[key].total += row.total;
      // Prefer mixed-case name over all-caps when available
      if (row.city !== row.city.toUpperCase()) dataMap[key].city = row.city;
    }
  }
  const data = Object.values(dataMap);

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
      const row = data.find(r => r.city.toLowerCase() === city.toLowerCase() && r.month === i + 1);
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
        <button className={`graphs-view-btn${view === 'multiyear' ? ' active' : ''}`} onClick={() => setView('multiyear')}>
          Multi-Year
        </button>
      </div>

      {view === 'yoy' ? (
        <YoyView year={year} month={month} />
      ) : view === 'multiyear' ? (
        <MultiYearView />
      ) : (
        <>
          <div className="graphs-trends-header">
            <div className="graphs-type-toggle">
              <button className={`graphs-type-btn${type === 'city' ? ' active' : ''}`} onClick={() => setType('city')}>Cities</button>
              <button className={`graphs-type-btn agency${type === 'agency' ? ' active' : ''}`} onClick={() => setType('agency')}>Agencies</button>
              <button className={`graphs-type-btn${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>All</button>
            </div>
            <select
              className="graphs-year-select"
              value={trendsYear}
              onChange={e => setTrendsYear(+e.target.value)}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : data.length === 0 ? (
            <div className="empty-state">No {type} data for {trendsYear}.</div>
          ) : (
            <>
              <div className="graphs-summary">
                <div className="graphs-summary-item">
                  <span className="graphs-summary-val">{yearTotal.toLocaleString()}</span>
                  <span className="graphs-summary-lbl">{trendsYear} total</span>
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

              <p className="stats-header" style={{ marginBottom: 4 }}>Monthly totals — {trendsYear}</p>
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
