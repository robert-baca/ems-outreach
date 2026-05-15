import { useState, useRef, useEffect } from 'react';
import { MONTHS } from '../cityData.js';

export default function AiTab({ stats, agencyStats, month, year, viewMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function buildContext() {
    const period = viewMode === 'year' ? `${year} full year` : `${MONTHS[month - 1]} ${year}`;
    const topCities = stats
      .slice(0, 10)
      .map((s, i) => `  ${i + 1}. ${s.city} (${s.county} County): ${s.total} transports`)
      .join('\n');
    const topAgencies = agencyStats
      .slice(0, 8)
      .map((s, i) => `  ${i + 1}. ${s.city}: ${s.total} transports`)
      .join('\n');

    return `Current data snapshot — ${period}:

Top cities by transport volume:
${topCities || '  (no data)'}

Top EMS agencies:
${topAgencies || '  (no data)'}

Total city transports: ${stats.reduce((s, r) => s + r.total, 0)}
Total agency transports: ${agencyStats.reduce((s, r) => s + r.total, 0)}`;
  }

  const send = async () => {
    const q = input.trim();
    if (!q || streaming) return;

    const userMsg = { role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const aiMsg = { role: 'ai', text: '' };
    setMessages(prev => [...prev, aiMsg]);

    try {
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: buildContext() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'ai', text: `Error: ${err.error || 'Unknown error'}`, isError: true };
          return updated;
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'ai', text: `Error: ${error}`, isError: true };
                return updated;
              });
              break;
            }
            if (text) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], text: updated[updated.length - 1].text + text };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: `Error: ${err.message}`, isError: true };
        return updated;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const SUGGESTIONS = [
    'Which cities are trending up this month?',
    'Which agencies should we focus outreach on?',
    'What patterns do you see in this data?',
    'Suggest ways to grow transport volume.',
  ];

  return (
    <div className="ai-tab">
      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">🤖</div>
            <p>Ask me anything about your EMS transport data.</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="ai-suggestion" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-message ai-message-${m.role}${m.isError ? ' ai-message-error' : ''}`}>
            <span className="ai-message-label">{m.role === 'user' ? 'You' : 'AI'}</span>
            <div className="ai-message-text">{m.text}{m.role === 'ai' && streaming && i === messages.length - 1 && <span className="ai-cursor" />}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="ai-input-row">
        <textarea
          ref={inputRef}
          className="ai-input"
          rows={2}
          placeholder="Ask about your data…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={streaming}
        />
        <button className="ai-send-btn" onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}
