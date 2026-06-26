/**
 * PulseFeed — live scrolling feed of notable real trades (large prints + sweeps)
 * from MarketPulseEngine. Every row is an actual aggTrade: real price, qty, time.
 */
import { useState, useEffect } from 'react';

function fmtNotional(v) {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('he-IL', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);
}
function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

export default function PulseFeed({ engine }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300);
    return () => clearInterval(iv);
  }, []);

  const rows = engine ? engine.rows : [];

  return (
    <div className="bm-pulse">
      <div className="bm-pulse-head">⚡ Market Pulse</div>
      <div className="bm-pulse-list">
        {rows.length === 0 && <div className="bm-pulse-empty">ממתין לעסקאות גדולות…</div>}
        {rows.map((r, i) => (
          <div className={`bm-pulse-row ${r.buy ? 'bm-pulse-buy' : 'bm-pulse-sell'}`} key={r.ts + '-' + i}>
            <span className="bm-pulse-side">{r.sweep ? '🌊' : (r.buy ? '▲' : '▼')}</span>
            <span className="bm-pulse-price">{fmtPrice(r.price)}</span>
            <span className="bm-pulse-notional">{fmtNotional(r.notional)}</span>
            <span className="bm-pulse-time">{fmtTime(r.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
