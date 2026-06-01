import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DFW_CITIES, MONTHS } from '../cityData.js';
import { apiFetch } from '../api.js';

const KNOWN = new Set(DFW_CITIES.map(c => c.city.toLowerCase()));

const MONTH_HEADER = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3,
  apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7,
  aug:8, august:8, sep:9, sept:9, september:9,
  oct:10, october:10, nov:11, november:11, dec:12, december:12,
};

// ── Wide format (your current sheet: agencies in rows, Jan-Dec in columns) ──

function yearFromSheetName(name) {
  const m = String(name).match(/\d{4}/);
  return m ? +m[0] : new Date().getFullYear();
}

function parseWideFormat(ws, sheetName) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const year = yearFromSheetName(sheetName);

  // Find the header row — first row that has 6+ month names
  let headerIdx = -1;
  let monthCols = {}; // colIndex → monthNumber

  for (let i = 0; i < Math.min(6, data.length); i++) {
    const cols = {};
    data[i].forEach((cell, j) => {
      const key = String(cell).toLowerCase().trim();
      if (MONTH_HEADER[key]) cols[j] = MONTH_HEADER[key];
    });
    if (Object.keys(cols).length >= 6) { headerIdx = i; monthCols = cols; break; }
  }

  if (headerIdx === -1) return null; // not wide format

  const rows = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    const name = String(row[0] ?? '').trim();
    if (!name) continue;

    // Determine type: known DFW city → 'city', otherwise → 'agency'
    const type = KNOWN.has(name.toLowerCase()) ? 'city' : 'agency';

    for (const [colIdx, month] of Object.entries(monthCols)) {
      const count = parseInt(row[colIdx], 10);
      if (!isNaN(count) && count > 0) {
        rows.push({ city: name, count, month, year, type, errors: [] });
      }
    }
  }
  return rows;
}

// ── Tall format (City / Count / Month / Year columns) ──

const MONTH_NAMES = { ...MONTH_HEADER };

function normalizeKey(k) { return String(k).toLowerCase().replace(/[\s_]+/g, ''); }

function parseMonth(val) {
  if (!val) return null;
  const n = parseInt(val, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return MONTH_NAMES[String(val).toLowerCase().trim()] ?? null;
}

function parseTallFormat(ws) {
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return json.map(raw => {
    const m = {};
    for (const [k, v] of Object.entries(raw)) m[normalizeKey(k)] = v;
    const city  = String(m.city ?? m.cityname ?? m.emsagency ?? m.agency ?? m.location ?? '').trim();
    const count = parseInt(m.count ?? m.transports ?? m.volume ?? m.transportcount ?? 1, 10);
    const month = parseMonth(m.month ?? m.mo ?? '');
    const year  = parseInt(m.year ?? m.yr ?? '', 10);
    const type  = String(m.type ?? 'city').toLowerCase() === 'agency' ? 'agency' : 'city';
    const errors = [];
    if (!city)       errors.push('missing name');
    if (!month)      errors.push('invalid month');
    if (isNaN(year)) errors.push('invalid year');
    return { city, count: isNaN(count) ? 1 : count, month, year, type, errors };
  });
}

// ── Template download — matches your current sheet format ──

function downloadTemplate(year) {
  const header1 = ['EMS AGENCY', `FY${year}`, '', '', '', '', '', '', '', '', '', '', ''];
  const header2 = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const samples = [
    ['Colleyville', 62,71,63,63,63,61,60,59,65,49,53,56],
    ['Coppell',     49,44,50,37,58,61,49,39,62,47,46,50],
    ['Euless',      49,63,62,51,75,68,50,64,79,75,53,68],
    ['CAREFLITE',    1, 0, 2, 6, 1, 5, 5,10, 5, 5, 5, 3],
    ['ACADIAN',      2, 5, 1, 3, 3, 4, 2, 3, 1, 7, 1, 4],
  ];

  const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...samples]);
  ws['!merges'] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 12 } }];
  ws['!cols'] = [{ wch: 22 }, ...Array(12).fill({ wch: 6 })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `FY${year}`);
  XLSX.writeFile(wb, `ems_template_FY${year}.xlsx`);
}

// ── Component ──

export default function ImportModal({ customCities, onClose, onSuccess }) {
  const [rows, setRows]         = useState([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState(null);
  const [formatUsed, setFormatUsed] = useState('');
  const [templateYear, setTemplateYear] = useState(new Date().getFullYear());
  const [yearOverride, setYearOverride] = useState('');
  const fileRef = useRef();

  const allKnown = new Set([
    ...Array.from(KNOWN),
    ...customCities.map(c => c.city.toLowerCase()),
  ]);

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const wb   = XLSX.read(e.target.result, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws   = wb.Sheets[sheetName];

      // Try wide format first (your current sheet style)
      const wide = parseWideFormat(ws, sheetName);
      if (wide) {
        setRows(wide);
        setFormatUsed('wide');
      } else {
        setRows(parseTallFormat(ws));
        setFormatUsed('tall');
      }
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  const overrideYear = yearOverride !== '' ? +yearOverride : null;
  const displayRows = overrideYear
    ? rows.map(r => ({ ...r, year: overrideYear, errors: r.errors.filter(e => e !== 'invalid year') }))
    : rows;
  const validRows  = displayRows.filter(r => r.errors.length === 0);
  const cityRows   = validRows.filter(r => r.type === 'city');
  const agencyRows = validRows.filter(r => r.type === 'agency');
  const newCities = [...new Set(
    cityRows.filter(r => !allKnown.has(r.city.toLowerCase())).map(r => r.city)
  )];

  async function handleImport() {
    setImporting(true);
    try {
      const records = validRows.map(r => ({
        city: r.city, county: null,
        transport_count: r.count,
        month: r.month, year: r.year,
        type: r.type,
      }));
      const resp = await apiFetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, newCities }),
      }).then(r => r.json());
      setResult(resp);
      onSuccess(resp);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Import Spreadsheet</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="template-hint">
            <strong>Supports your current format</strong> — agency names in rows, months (Jan–Dec) across the top.
            <br />
            Known DFW cities map as city pins · Everything else (CAREFLITE, ACADIAN, etc.) goes to the Agencies tab.
            <br />
            <div className="template-download-row">
              <input
                type="number" min={2020} max={2099}
                className="template-year-input"
                value={templateYear}
                onChange={e => setTemplateYear(+e.target.value)}
              />
              <button className="btn-template" onClick={() => downloadTemplate(templateYear)}>
                ⬇ Download {templateYear} template (.xlsx)
              </button>
            </div>
          </div>

          {rows.length === 0 && (
            <div
              className={`drop-zone${dragging ? ' drag-over' : ''}`}
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) parseFile(f);
              }}
            >
              <div style={{ fontSize: 32 }}>📂</div>
              <p>Drop your .xlsx or .csv file here, or click to browse</p>
              <small>Supports Excel (.xlsx, .xls) and CSV files</small>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden
                onChange={e => { if (e.target.files[0]) parseFile(e.target.files[0]); }} />
            </div>
          )}

          {rows.length > 0 && !result && (
            <>
              <div className="import-year-override">
                <label>Override year for all rows:</label>
                <input
                  type="number" min={2020} max={2099}
                  className="template-year-input"
                  value={yearOverride}
                  placeholder={String(rows[0]?.year || new Date().getFullYear())}
                  onChange={e => setYearOverride(e.target.value)}
                />
                {yearOverride && (
                  <button className="import-year-clear" onClick={() => setYearOverride('')}>✕ Clear</button>
                )}
                <span className="import-year-hint">
                  {yearOverride ? `All rows → ${yearOverride}` : 'Leave blank to use year from file'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, color: '#4a5568' }}>
                  <strong>{validRows.length}</strong> records
                  {rows.length - validRows.length > 0 && ` · ${rows.length - validRows.length} skipped`}
                  {' · '}<span style={{ color: '#1a365d' }}>{cityRows.length} city</span>
                  {' · '}<span style={{ color: '#667eea' }}>{agencyRows.length} agency</span>
                  {newCities.length > 0 && (
                    <span style={{ color: '#2b6cb0' }}> · {newCities.length} new map pin{newCities.length !== 1 ? 's' : ''}</span>
                  )}
                </p>
                <button className="btn-cancel" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => { setRows([]); setYearOverride(''); fileRef.current.value = ''; }}>
                  Clear
                </button>
              </div>

              <div className="preview-wrap">
                <table className="preview-table">
                  <thead>
                    <tr><th>Name</th><th>Count</th><th>Month</th><th>Year</th><th>Type</th></tr>
                  </thead>
                  <tbody>
                    {displayRows.map((r, i) => (
                      <tr key={i} style={{ opacity: r.errors.length ? 0.4 : 1 }}>
                        <td>{r.city || '—'}</td>
                        <td>{r.count}</td>
                        <td>{r.month ? MONTHS[r.month - 1] : '—'}</td>
                        <td>{r.year || '—'}</td>
                        <td>
                          {r.errors.length > 0
                            ? <span className="badge-error">{r.errors[0]}</span>
                            : r.type === 'agency'
                              ? <span className="badge-agency">agency</span>
                              : allKnown.has(r.city.toLowerCase())
                                ? <span className="badge-known">city</span>
                                : <span className="badge-new">new pin</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>
                {result.saved} record{result.saved !== 1 ? 's' : ''} imported
              </p>
              {result.skipped > 0 && (
                <p style={{ color: '#718096', fontSize: 13, marginTop: 4 }}>
                  {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped (already in database)
                </p>
              )}
              {result.geocoded > 0 && (
                <p style={{ color: '#2b6cb0', fontSize: 13, marginTop: 6 }}>
                  {result.geocoded} new pin{result.geocoded !== 1 ? 's' : ''} added to map:{' '}
                  {result.geocodedCities.map(c => c.city).join(', ')}
                </p>
              )}
              {result.failed?.length > 0 && (
                <p style={{ color: '#c53030', fontSize: 12, marginTop: 4 }}>
                  Could not locate: {result.failed.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              className="btn-import"
              disabled={validRows.length === 0 || importing}
              onClick={handleImport}
            >
              {importing
                ? `Importing${newCities.length > 0 ? `, geocoding ${newCities.length}…` : '…'}`
                : `Import ${validRows.length} record${validRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
