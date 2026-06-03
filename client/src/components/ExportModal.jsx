import { useState, useEffect } from 'react';
import { MONTHS } from '../cityData.js';
import { apiFetch } from '../api.js';

const SHORT = MONTHS.map(m => m.slice(0, 3));

export default function ExportModal({ stats, prevStats, agencyStats, month, year, viewMode, hospitalConfig, onClose }) {
  const [monthlyTotals, setMonthlyTotals] = useState(Array(12).fill(0));

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/trends?year=${year}&type=city`).then(r => r.json()),
      apiFetch(`/api/trends?year=${year}&type=agency`).then(r => r.json()),
    ]).then(([city, agency]) => {
      const totals = Array(12).fill(0);
      [...city, ...agency].forEach(r => {
        if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += r.total;
      });
      setMonthlyTotals(totals);
    }).catch(() => {});
  }, [year]);

  const isYear = viewMode === 'year';
  const period = isYear ? `Full Year ${year}` : `${MONTHS[month - 1]} ${year}`;
  const hospitalName = hospitalConfig?.name ?? 'Baylor Scott & White Medical Center — Grapevine';

  const cityTotal    = stats.reduce((s, r) => s + r.total, 0);
  const agencyTotal  = agencyStats.reduce((s, r) => s + r.total, 0);
  const grandTotal   = cityTotal + agencyTotal;
  const prevTotal    = prevStats.reduce((s, r) => s + r.total, 0);
  const pct          = prevTotal > 0 ? Math.round(((cityTotal - prevTotal) / prevTotal) * 100) : null;
  const ytd          = monthlyTotals.slice(0, month).reduce((s, v) => s + v, 0);

  const maxCity      = stats[0]?.total || 1;
  const maxAgency    = agencyStats[0]?.total || 1;
  const maxBar       = Math.max(...monthlyTotals, 1);

  const generatedOn = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="report-overlay">
      {/* Controls — hidden when printing */}
      <div className="report-controls no-print">
        <button className="report-print-btn" onClick={() => window.print()}>
          🖨 Print / Save as PDF
        </button>
        <button className="report-close-btn" onClick={onClose}>✕ Close</button>
      </div>

      <div className="report-page">

        {/* ── Header ── */}
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

        {/* ── Stat cards ── */}
        <div className="report-stats-row">
          <div className="report-stat-card report-stat-primary">
            <div className="report-stat-label">Total Transports</div>
            <div className="report-stat-value">{grandTotal.toLocaleString()}</div>
            <div className="report-stat-sub">{cityTotal.toLocaleString()} city · {agencyTotal.toLocaleString()} agency</div>
          </div>

          {!isYear && pct !== null && (
            <div className="report-stat-card">
              <div className="report-stat-label">vs Last Period</div>
              <div className={`report-stat-value report-delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`}>
                {pct > 0 ? '▲' : pct < 0 ? '▼' : '●'} {Math.abs(pct)}%
              </div>
              <div className="report-stat-sub">{prevTotal.toLocaleString()} last month</div>
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

        {/* ── Body: cities (left) + agencies + trend (right) ── */}
        <div className="report-body">

          {/* City rankings */}
          <div className="report-col-left">
            <div className="report-section-title">City Transport Volume</div>
            <table className="report-rank-table">
              <tbody>
                {stats.slice(0, 15).map((s, i) => (
                  <tr key={s.city}>
                    <td className="report-rank-num">#{i + 1}</td>
                    <td className="report-rank-name">{s.city}</td>
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

          {/* Right column */}
          <div className="report-col-right">

            {/* Agencies */}
            {agencyStats.length > 0 && (
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

            {/* Monthly trend bars */}
            <div className="report-trend-block">
              <div className="report-section-title">{year} Monthly Volume</div>
              <div className="report-trend-bars">
                {monthlyTotals.map((v, i) => {
                  const barH = v > 0 ? Math.max(6, Math.round((v / maxBar) * 64)) : 3;
                  const isCur = i === month - 1;
                  const isFuture = i > month - 1 && !isYear;
                  return (
                    <div key={i} className="report-trend-col">
                      {v > 0 && <span className="report-trend-val">{v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}</span>}
                      <div className="report-trend-bar-wrap">
                        <div className="report-trend-bar"
                          style={{
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

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="report-footer">
          Generated {generatedOn} · EMS Outreach · {hospitalName}
        </div>

      </div>
    </div>
  );
}
