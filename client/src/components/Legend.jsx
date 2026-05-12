const MONTHLY_SWATCHES = [
  { color: '#e2e8f0', label: 'No data' },
  { color: '#c6f6d5', label: '1 – 5' },
  { color: '#48bb78', label: '6 – 15' },
  { color: '#f6e05e', label: '16 – 30' },
  { color: '#ed8936', label: '31 – 50' },
  { color: '#e53e3e', label: '51+' },
];

const YEARLY_SWATCHES = [
  { color: '#e2e8f0', label: 'No data' },
  { color: '#c6f6d5', label: '1 – 60' },
  { color: '#48bb78', label: '61 – 180' },
  { color: '#f6e05e', label: '181 – 360' },
  { color: '#ed8936', label: '361 – 600' },
  { color: '#e53e3e', label: '601+' },
];

export default function Legend({ viewMode = 'month' }) {
  const swatches = viewMode === 'year' ? YEARLY_SWATCHES : MONTHLY_SWATCHES;
  const title = viewMode === 'year' ? 'Yearly Volume' : 'Monthly Volume';
  return (
    <div className="map-legend">
      <h4>{title}</h4>
      {swatches.map(({ color, label }) => (
        <div key={label} className="legend-item">
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            background: color, border: '1px solid rgba(0,0,0,.12)',
            flexShrink: 0,
          }} />
          <span className="legend-label">{label}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 6, fontSize: 11, color: '#a0aec0' }}>
        Dot size scales with volume
      </div>
    </div>
  );
}
