import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DFW_CITIES, MONTHS } from '../cityData.js';

const KNOWN = new Set(DFW_CITIES.map(c => c.city.toLowerCase()));

const MONTH_NAMES = {
  january:1, jan:1, february:2, feb:2, march:3, mar:3,
  april:4, apr:4, may:5, june:6, jun:6, july:7, jul:7,
  august:8, aug:8, september:9, sep:9, sept:9,
  october:10, oct:10, november:11, nov:11, december:12, dec:12,
};

function normalizeKey(k) { return String(k).toLowerCase().replace(/[\s_]+/g, ''); }

function parseMonth(val) {
  if (!val) return null;
  const n = parseInt(val, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return MONTH_NAMES[String(val).toLowerCase().trim()] ?? null;
}

function normalizeRow(raw) {
  const m = {};
  for (const [k, v] of Object.entries(raw)) m[normalizeKey(k)] = v;

  const city  = String(m.city ?? m.cityname ?? m.location ?? '').trim();
  const count = parseInt(m.count ?? m.transports ?? m.volume ?? m.transportcount ?? m.number ?? 1, 10);
  const month = parseMonth(m.month ?? m.mo ?? m.monthnum ?? '');
  const year  = parseInt(m.year ?? m.yr ?? '', 10);

  const errors = [];
  if (!city)       errors.push('missing city');
  if (!month)      errors.push('invalid month');
  if (isNaN(year)) errors.push('invalid year');

  return { city, count: isNaN(count) ? 1 : count, month, year, errors };
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['City', 'Count', 'Month', 'Year'],
    ['Grapevine', 5, 5, 2026],
    ['Fort Worth', 12, 5, 2026],
    ['Irving', 8, 5, 2026],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transports');
  XLSX.writeFile(wb, 'ems_import_template.xlsx');
}

export default function ImportModal({ customCities, onClose, onSuccess }) {
  const [rows, setRows]         = useState([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState(null);
  const fileRef = useRef();

  const allKnown = new Set([
    ...Array.from(KNOWN),
    ...customCities.map(c => c.city.toLowerCase()),
  ]);

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setRows(json.map(normalizeRow));
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows  = rows.filter(r => r.errors.length === 0);
  const newCities  = [...new Set(
    validRows.filter(r => !allKnown.has(r.city.toLowerCase())).map(r => r.city)
  )];

  async function handleImport() {
    setImporting(true);
    try {
      const records = validRows.map(r => ({
        city: r.city,
        county: null,
        transport_count: r.count,
        service_line: null,
        ems_agency: null,
        month: r.month,
        year: r.year,
      }));
      const resp = await fetch('/api/import', {
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
          {/* Template hint */}
          <div className="template-hint">
            <strong>Expected columns:</strong>{' '}
            <code>City, Count, Month, Year</code>
            <br />
            Month can be a number (1–12) or name (January, Jan, etc.)
            <br />
            <button className="btn-template" onClick={downloadTemplate}>
              ⬇ Download template (.xlsx)
            </button>
          </div>

          {/* Drop zone */}
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

          {/* Preview */}
          {rows.length > 0 && !result && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, color: '#4a5568' }}>
                  <strong>{validRows.length}</strong> valid rows
                  {rows.length - validRows.length > 0 && ` · ${rows.length - validRows.length} skipped`}
                  {newCities.length > 0 && (
                    <span style={{ color: '#2b6cb0' }}> · {newCities.length} new city{newCities.length !== 1 ? 'ies' : ''} will be geocoded</span>
                  )}
                </p>
                <button className="btn-cancel" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => { setRows([]); fileRef.current.value = ''; }}>
                  Clear
                </button>
              </div>

              {newCities.length > 0 && (
                <div className="geocode-status">
                  New departments to add: {newCities.map((c, i) => (
                    <span key={c}>{i > 0 && ', '}<span>{c}</span></span>
                  ))}
                  <br />
                  <small>Coordinates will be looked up automatically via OpenStreetMap.</small>
                </div>
              )}

              <div className="preview-wrap">
                <table className="preview-table">
                  <thead>
                    <tr><th>City</th><th>Count</th><th>Month</th><th>Year</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ opacity: r.errors.length ? 0.5 : 1 }}>
                        <td>{r.city || '—'}</td>
                        <td>{r.count}</td>
                        <td>{r.month ? MONTHS[r.month - 1] : '—'}</td>
                        <td>{r.year || '—'}</td>
                        <td>
                          {r.errors.length > 0
                            ? <span className="badge-error">{r.errors[0]}</span>
                            : allKnown.has(r.city.toLowerCase())
                              ? <span className="badge-known">known</span>
                              : <span className="badge-new">new dept</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>
                {result.saved} transport{result.saved !== 1 ? 's' : ''} imported
              </p>
              {result.geocoded > 0 && (
                <p style={{ color: '#2b6cb0', fontSize: 13, marginTop: 6 }}>
                  {result.geocoded} new department{result.geocoded !== 1 ? 's' : ''} added to map:{' '}
                  {result.geocodedCities.map(c => c.city).join(', ')}
                </p>
              )}
              {result.failed?.length > 0 && (
                <p style={{ color: '#c53030', fontSize: 12, marginTop: 4 }}>
                  Could not geocode: {result.failed.join(', ')}
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
                ? `Geocoding ${newCities.length} new dept${newCities.length !== 1 ? 's' : ''}…`
                : `Import ${validRows.length} record${validRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
