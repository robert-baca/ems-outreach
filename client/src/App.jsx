import { useState, useEffect, useCallback } from 'react';
import { useAuth, SignIn, SignedIn, SignedOut, useClerk } from '@clerk/clerk-react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import ImportModal from './components/ImportModal.jsx';
import QuickEntryModal from './components/QuickEntryModal.jsx';
import AdminPage from './components/AdminPage.jsx';
import { MONTHS } from './cityData.js';
import { apiFetch, setTokenGetter } from './api.js';

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const now = new Date();

function prevMonthYear(month, year) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

function AppShell() {
  if (CLERK_ENABLED) {
    return (
      <>
        <SignedOut>
          <div className="signin-screen">
            <div className="signin-card">
              <span className="signin-icon">🏥</span>
              <h1>EMS Outreach</h1>
              <p>Baylor Scott &amp; White</p>
              <SignIn routing="hash" />
            </div>
          </div>
        </SignedOut>
        <SignedIn>
          <AppInner />
        </SignedIn>
      </>
    );
  }
  return <AppInner />;
}

export default AppShell;

function AppInner() {
  const { getToken } = CLERK_ENABLED ? useAuth() : { getToken: null };
  const { signOut } = CLERK_ENABLED ? useClerk() : { signOut: null };

  useEffect(() => {
    if (getToken) setTokenGetter(getToken);
  }, [getToken]);
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
  const [showAdmin, setShowAdmin]           = useState(false);
  const [hospitalConfig, setHospitalConfig] = useState(null);

  useEffect(() => {
    apiFetch('/api/cities').then(r => r.json()).then(setCustomCities).catch(() => {});
    apiFetch('/api/hospital').then(r => r.json()).then(setHospitalConfig).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const isYear = viewMode === 'year';
    const mParam = isYear ? '' : `&month=${month}`;
    const { month: pm, year: py } = prevMonthYear(month, year);
    const prevParam = isYear ? `year=${year - 1}` : `month=${pm}&year=${py}`;
    try {
      const [sRes, tRes, pRes, asRes, atRes] = await Promise.all([
        apiFetch(`/api/stats?${mParam ? mParam.slice(1) + '&' : ''}year=${year}&type=city`),
        apiFetch(`/api/transports?month=${month}&year=${year}&type=city`),
        apiFetch(`/api/stats?${prevParam}&type=city`),
        apiFetch(`/api/stats?${mParam ? mParam.slice(1) + '&' : ''}year=${year}&type=agency`),
        apiFetch(`/api/transports?month=${month}&year=${year}&type=agency`),
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
    const data = await apiFetch(`/api/cities?mode=history&city=${encodeURIComponent(cityName)}`).then(r => r.json());
    setCityHistory(data);
  }, []);

  const handleAdd = async (entry) => {
    const resp = await apiFetch('/api/transports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).then(r => r.json());
    if (resp.newCity) {
      apiFetch('/api/cities').then(r => r.json()).then(setCustomCities);
    }
    fetchData();
    if (selectedCity && entry.city?.toLowerCase() === selectedCity.toLowerCase()) {
      handleCityClick(selectedCity);
    }
  };

  const handleQuickSave = async (rows) => {
    await Promise.all(rows.map(row =>
      apiFetch('/api/transports', {
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
    await apiFetch(`/api/transports/${id}`, { method: 'DELETE' });
    fetchData();
    if (selectedCity) handleCityClick(selectedCity);
  };

  const handleImportSuccess = (result) => {
    if (result.geocoded > 0) {
      apiFetch('/api/cities').then(r => r.json()).then(setCustomCities);
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
            <span className="header-sub">{hospitalConfig?.name ?? import.meta.env.VITE_HOSPITAL_NAME ?? 'Baylor Scott & White Medical Center — Grapevine'}</span>
            <span className="header-tagline">{hospitalConfig?.subtitle ?? import.meta.env.VITE_HOSPITAL_TAGLINE ?? 'A Baylor Grapevine EMS Solution'}</span>
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
          {CLERK_ENABLED && hospitalConfig?.isAdmin && (
            <button className="import-header-btn" onClick={() => setShowAdmin(true)}>⚙ Admin</button>
          )}
          {CLERK_ENABLED && signOut && (
            <button className="import-header-btn" onClick={() => signOut()} title="Sign out">↩ Sign Out</button>
          )}
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
          onPinsChange={() => apiFetch('/api/cities').then(r => r.json()).then(setCustomCities)}
          onRefresh={fetchData}
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
          customCities={customCities}
          onClose={() => setShowQuickEntry(false)}
          onSave={handleQuickSave}
        />
      )}
      {showAdmin && (
        <AdminPage onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
