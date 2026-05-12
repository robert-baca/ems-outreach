import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import Legend from './Legend.jsx';
import { DFW_CITIES } from '../cityData.js';

const BAYLOR_GRAPEVINE = [32.9339, -97.0783];

export function getColor(count) {
  if (!count || count === 0) return '#e2e8f0';
  if (count <= 5)  return '#c6f6d5';
  if (count <= 15) return '#48bb78';
  if (count <= 30) return '#f6e05e';
  if (count <= 50) return '#ed8936';
  return '#e53e3e';
}

function dotSize(count) {
  if (!count) return 8;
  return Math.round(Math.max(22, Math.min(48, 12 + Math.sqrt(count) * 3.8)));
}

function makeIcon(count, isSelected) {
  if (!count || count === 0) {
    const d = isSelected ? 11 : 8;
    return L.divIcon({
      html: `<div style="width:${d}px;height:${d}px;border-radius:50%;background:#cbd5e0;border:${isSelected ? '2px solid #1a365d' : '1px solid #a0aec0'};box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>`,
      className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
    });
  }

  const sz  = dotSize(count);
  const bg  = getColor(count);
  const fc  = count > 15 ? '#fff' : '#1a202c';
  const fs  = sz < 28 ? 10 : sz < 36 ? 12 : 14;
  const ring = isSelected
    ? 'box-shadow:0 0 0 3px #1a365d,0 2px 8px rgba(0,0,0,.35)'
    : 'box-shadow:0 1px 5px rgba(0,0,0,.28)';

  return L.divIcon({
    html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};border:2px solid rgba(0,0,0,.12);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:800;color:${fc};${ring};cursor:pointer">${count}</div>`,
    className: '',
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  });
}

function trendLabel(current, prev) {
  if (current === 0 && prev === 0) return null;
  if (current > 0  && prev === 0)  return 'New this month';
  if (current === 0 && prev > 0)   return `↓ from ${prev} last month`;
  const diff = current - prev;
  const pct  = Math.round(Math.abs(diff / prev) * 100);
  if (diff > 0) return `▲ ${pct}% vs last month`;
  if (diff < 0) return `▼ ${pct}% vs last month`;
  return 'No change vs last month';
}


export default function MapView({ stats, prevStats, selectedCity, onCityClick, customCities = [], viewMode = 'month' }) {
  const cityMap = {};
  stats.forEach(({ city, total }) => { cityMap[city.toLowerCase()] = total; });
  const prevMap = {};
  prevStats.forEach(({ city, total }) => { prevMap[city.toLowerCase()] = total; });

  const builtInNames = new Set(DFW_CITIES.map(c => c.city.toLowerCase()));
  const allCities = [
    ...DFW_CITIES,
    ...customCities.filter(c => !builtInNames.has(c.city.toLowerCase())),
  ];

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer center={BAYLOR_GRAPEVINE} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
          detectRetina={true}
        />

        {allCities.map(({ city, lat, lon }) => {
          const count = cityMap[city.toLowerCase()] || 0;
          const prev  = prevMap[city.toLowerCase()] || 0;
          const label = trendLabel(count, prev);
          const isSelected = selectedCity?.toLowerCase() === city.toLowerCase();
          // Normalize yearly totals to monthly scale for consistent dot sizing/coloring
          const displayCount = viewMode === 'year' ? Math.round(count / 12) : count;
          const icon = makeIcon(displayCount, isSelected);

          return (
            <Marker
              key={`${city}-${count}-${prev}-${isSelected}`}
              position={[lat, lon]}
              icon={icon}
              eventHandlers={{ click: () => onCityClick(city) }}
            >
              <Tooltip sticky>
                <strong>{city}</strong>
                {count > 0 && <><br />{count} transport{count !== 1 ? 's' : ''} {viewMode === 'year' ? 'this year' : 'this month'}</>}
                {viewMode === 'month' && label && <><br /><span style={{ fontSize: 11, color: '#718096' }}>{label}</span></>}
              </Tooltip>
            </Marker>
          );
        })}

      </MapContainer>

      <Legend />
    </div>
  );
}
