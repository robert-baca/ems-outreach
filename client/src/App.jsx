import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import ImportModal from './components/ImportModal.jsx';
import QuickEntryModal from './components/QuickEntryModal.jsx';
import { MONTHS } from './cityData.js';

const now = new Date();

function prevMonthYear(month, year) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export default function App() {
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'

  const [stats, setStats]               = useState([]);
  const [prevStats, setPrevStats]       = useState([]);
  const [transports, setTransports]     = useState([]);
  const [agencyStats, setAgencyStats]   = useState([]);
  const [agencyTransports, setAgencyTransports] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityHistory, setCityHistory]   = useState([]);
  const [customCities, setCustomCities] = useState([]);
  const [showImport, setShowImport]         = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  useEffect(() => {
    fetch('/api/cities/custom').then(r => r.json()).then(setCustomCities).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const isYear = viewMode === 'year';
    const mParam = isYear ? '' : `&month=${month}`;
    const { month: pm, year: py } = prevMonthYear(month, year);
    const prevParam = isYear ? `year=${year - 1}` : `month=${pm}&year=${py}`;
    try {
      const [sRes, tRes, pRes, asRes, atRes] = await Promise.all([
        fetch(`/api/stats?${mParam ? mParam.slice(1) + '&' : ''}year=${year}&type=city`),
        fetch(`/api/transports?month=${month}&year=${year}&type=city`),
        fetch(`/api/stats?${prevParam}&type=city`),
        fetch(`/api/stats?${mParam ? mParam.slice(1) + '&' : ''}year=${year}&type=agency`),
        fetch(`/api/transports?month=${month}&year=${year}&type=agency`),
      ]);
      setStats(await sRes.json());
      setTransports(await tRes.json());
      setPrevStats(await pRes.json());
      setAgencyStats(await asRes.json());
      setAgencyTransports(await atRes.json());
    } finally {
      setLoading(false);
    }
  }, [month, year, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCityClick = useCallback(async (cityName) => {
    setSelectedCity(cityName);
    const data = await fetch(`/api/city-history?city=${encodeURIComponent(cityName)}`).then(r => r.json());
    setCityHistory(data);
  }, []);

  const handleAdd = async (entry) => {
    const resp = await fetch('/api/transports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).then(r => r.json());
    if (resp.newCity) {
      fetch('/api/cities/custom').then(r => r.json()).then(setCustomCities);
    }
    fetchData();
    if (selectedCity && entry.city?.toLowerCase() === selectedCity.toLowerCase()) {
      handleCityClick(selectedCity);
    }
  };

  const handleQuickSave = async (rows) => {
    await Promise.all(rows.map(row =>
      fetch('/api/transports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: row.city, county: null,
          transport_count: row.count,
          month: row.month, year: row.year,
          type: row.type, knownCities: [],
        }),
      })
    ));
    fetchData();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/transports/${id}`, { method: 'DELETE' });
    fetchData();
    if (selectedCity) handleCityClick(selectedCity);
  };

  const handleImportSuccess = (result) => {
    if (result.geocoded > 0) {
      fetch('/api/cities/custom').then(r => r.json()).then(setCustomCities);
    }
    fetchData();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="header-icon">🏥</span>
          <div>
            <h1>EMS Outreach</h1>
            <span className="header-sub">Baylor Scott &amp; White Medical Center — Grapevine</span>
            <span className="header-tagline">A Baylor Grapevine EMS Solution</span>
          </div>
        </div>
        <div className="month-selector">
          {viewMode === 'month' && (
            <select value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(+e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => 2020 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className={`view-toggle${viewMode === 'year' ? ' active' : ''}`}
            onClick={() => setViewMode(v => v === 'month' ? 'year' : 'month')}
            title="Toggle monthly / yearly view"
          >
            {viewMode === 'month' ? 'Monthly' : 'Full Year'}
          </button>
          {loading && <span className="loading-dot" />}
          <button className="import-header-btn" onClick={() => setShowQuickEntry(true)}>✏ Quick Entry</button>
          <button className="import-header-btn" onClick={() => setShowImport(true)}>⬆ Import</button>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          stats={stats}
          transports={transports}
          agencyStats={agencyStats}
          agencyTransports={agencyTransports}
          selectedCity={selectedCity}
          cityHistory={cityHistory}
          onClearCity={() => setSelectedCity(null)}
          month={month}
          year={year}
          viewMode={viewMode}
          onAdd={handleAdd}
          onDelete={handleDelete}
          customCities={customCities}
          onPinsChange={() => fetch('/api/cities/custom').then(r => r.json()).then(setCustomCities)}
        />
        <main className="map-container">
          <MapView
            stats={stats}
            prevStats={prevStats}
            month={month}
            year={year}
            viewMode={viewMode}
            selectedCity={selectedCity}
            onCityClick={handleCityClick}
            customCities={customCities}
          />
        </main>
      </div>

      {showImport && (
        <ImportModal
          customCities={customCities}
          onClose={() => setShowImport(false)}
          onSuccess={result => { handleImportSuccess(result); }}
        />
      )}
      {showQuickEntry && (
        <QuickEntryModal
          month={month}
          year={year}
          onClose={() => setShowQuickEntry(false)}
          onSave={handleQuickSave}
        />
      )}
    </div>
  );
}
