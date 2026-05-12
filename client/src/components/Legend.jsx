const SWATCHES = [
  { color: '#e2e8f0', label: 'No data this month' },
  { color: '#c6f6d5', label: '1 – 5 transports' },
  { color: '#48bb78', label: '6 – 15 transports' },
  { color: '#f6e05e', label: '16 – 30 transports' },
  { color: '#ed8936', label: '31 – 50 transports' },
  { color: '#e53e3e', label: '51 + transports' },
];

export default function Legend() {
  return (
    <div className="map-legend">
      <h4>Monthly Volume</h4>
      {SWATCHES.map(({ color, label }) => (
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
