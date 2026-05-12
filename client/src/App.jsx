import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import ImportModal from './components/ImportModal.jsx';
import { MONTHS } from './cityData.js';

const now = new Date();

function prevMonthYear(month, year) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export default function App() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [stats, setStats]           = useState([]);
  const [prevStats, setPrevStats]   = useState([]);
  const [transports, setTransports] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityHistory, setCityHistory]   = useState([]);
  const [customCities, setCustomCities] = useState([]);
  const [showImport, setShowImport]     = useState(false);

  // Load custom (geocoded) cities once on mount
  useEffect(() => {
    fetch('/api/cities/custom').then(r => r.json()).then(setCustomCities).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { month: pm, year: py } = prevMonthYear(month, year);
    try {
      const [sRes, tRes, pRes] = await Promise.all([
        fetch(`/api/stats?month=${month}&year=${year}`),
        fetch(`/api/transports?month=${month}&year=${year}`),
        fetch(`/api/stats?month=${pm}&year=${py}`),
      ]);
      setStats(await sRes.json());
      setTransports(await tRes.json());
      setPrevStats(await pRes.json());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

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
    if (selectedCity && entry.city.toLowerCase() === selectedCity.toLowerCase()) handleCityClick(selectedCity);
  };

  const handleDelete = async (id) => {
    await fetch(`/api/transports/${id}`, { method: 'DELETE' });
    fetchData();
    if (selectedCity) handleCityClick(selectedCity);
  };

  const handleImportSuccess = (result) => {
    // Reload custom cities if new ones were geocoded
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
          </div>
        </div>
        <div className="month-selector">
          <select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} min={2020} max={2099}
            onChange={e => setYear(+e.target.value)} />
          {loading && <span className="loading-dot" />}
          <button className="import-header-btn" onClick={() => setShowImport(true)}>
            ⬆ Import
          </button>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          stats={stats}
          prevStats={prevStats}
          transports={transports}
          selectedCity={selectedCity}
          cityHistory={cityHistory}
          onClearCity={() => setSelectedCity(null)}
          month={month}
          year={year}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
        <main className="map-container">
          <MapView
            stats={stats}
            prevStats={prevStats}
            month={month}
            year={year}
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
    </div>
  );
}
