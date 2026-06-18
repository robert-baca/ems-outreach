import { useState, useEffect } from 'react';

export default function PinGate({ children }) {
  const [authenticated, setAuthenticated] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/session')
      .then(r => r.json())
      .then(data => setAuthenticated(!!data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (resp.ok) {
        setAuthenticated(true);
      } else {
        setError('Incorrect PIN');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated === null) return null;

  if (!authenticated) {
    return (
      <div className="signin-screen">
        <div className="signin-card">
          <span className="signin-icon">🏥</span>
          <h1>EMS Outreach</h1>
          <p>Baylor Scott &amp; White</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN"
              autoFocus
              style={{ padding: '0.6rem', fontSize: '1rem', textAlign: 'center' }}
            />
            {error && <span style={{ color: '#d33', fontSize: '0.85rem' }}>{error}</span>}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Checking…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
}

export async function logout() {
  await fetch('/api/login', { method: 'DELETE' });
  window.location.reload();
}
