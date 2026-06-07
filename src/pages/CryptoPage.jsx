import { useState, useEffect } from 'react';
import './CryptoPage.css';

const COINS = [
  { id: 'bitcoin',      sym: 'BTC',  icon: '₿' },
  { id: 'ethereum',     sym: 'ETH',  icon: 'Ξ' },
  { id: 'solana',       sym: 'SOL',  icon: '◎' },
  { id: 'binancecoin',  sym: 'BNB',  icon: 'B' },
  { id: 'ripple',       sym: 'XRP',  icon: 'X' },
  { id: 'cardano',      sym: 'ADA',  icon: 'A' },
  { id: 'dogecoin',     sym: 'DOGE', icon: 'D' },
  { id: 'polkadot',     sym: 'DOT',  icon: '●' },
];

export default function CryptoPage() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    const ids = COINS.map(c => c.id).join(',');
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then(d => {
        const result = COINS.map(c => ({
          ...c,
          price:  d[c.id]?.usd,
          change: d[c.id]?.usd_24h_change,
        }));
        setCoins(result);
        setLoading(false);
      })
      .catch(() => { setError('שגיאה בטעינת נתונים — בדוק חיבור'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="crypto-wrap">
      <div className="crypto-hdr">
        <h2 className="crypto-title">₿ קריפטו</h2>
        <button className="crypto-refresh" onClick={load} disabled={loading}>
          {loading ? '...' : '↻ רענן'}
        </button>
      </div>

      {error && (
        <div className="crypto-error">
          {error}
          <button onClick={load}>נסה שוב</button>
        </div>
      )}

      {loading && !error && (
        <div className="crypto-loading">טוען נתונים...</div>
      )}

      {!loading && !error && (
        <div className="crypto-grid">
          {coins.map(c => {
            const up = (c.change || 0) >= 0;
            return (
              <div key={c.id} className="crypto-card">
                <div className="crypto-card-icon">{c.icon}</div>
                <div className="crypto-card-sym">{c.sym}</div>
                <div className="crypto-card-price">
                  {c.price ? `$${c.price.toLocaleString()}` : '—'}
                </div>
                <div className="crypto-card-change" style={{ color: up ? '#4ade80' : '#ef4444' }}>
                  {c.change ? `${up ? '▲' : '▼'} ${Math.abs(c.change).toFixed(2)}%` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
