import { useState, useEffect, useCallback } from 'react';
import './CryptoPage.css';

const COINS = [
  { id: 'bitcoin',      sym: 'BTC',  icon: '₿',  name: 'Bitcoin'   },
  { id: 'ethereum',     sym: 'ETH',  icon: 'Ξ',  name: 'Ethereum'  },
  { id: 'solana',       sym: 'SOL',  icon: '◎',  name: 'Solana'    },
  { id: 'binancecoin',  sym: 'BNB',  icon: 'B',  name: 'BNB'       },
  { id: 'ripple',       sym: 'XRP',  icon: 'X',  name: 'XRP'       },
  { id: 'cardano',      sym: 'ADA',  icon: 'A',  name: 'Cardano'   },
  { id: 'dogecoin',     sym: 'DOGE', icon: 'D',  name: 'Dogecoin'  },
  { id: 'polkadot',     sym: 'DOT',  icon: '●',  name: 'Polkadot'  },
];

function Skeleton() {
  return <div className="crypto-skeleton" />;
}

export default function CryptoPage() {
  const [coins,      setCoins]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    const ids = COINS.map(c => c.id).join(',');
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`)
      .then(r => r.json())
      .then(d => {
        const result = COINS.map(c => ({
          ...c,
          price:  d[c.id]?.usd,
          change: d[c.id]?.usd_24h_change,
          mcap:   d[c.id]?.usd_market_cap,
        }));
        setCoins(result);
        setLoading(false);
        setLastUpdate(new Date().toLocaleTimeString('he-IL', {
          timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }));
      })
      .catch(() => {
        setError('שגיאה בטעינת נתונים — בדוק חיבור');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtMcap = (n) => {
    if (!n) return '';
    if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n/1e9).toFixed(1)}B`;
    return `$${(n/1e6).toFixed(0)}M`;
  };

  return (
    <div className="crypto-wrap">

      {/* Header */}
      <div className="crypto-hdr">
        <h2 className="crypto-title">₿ קריפטו</h2>
        <div className="crypto-hdr-right">
          {lastUpdate && <span className="crypto-updated">עדכון: {lastUpdate}</span>}
          <button className="crypto-refresh" onClick={load} disabled={loading}>
            {loading ? '⏳' : '↻ רענן'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="crypto-error">
          <span>{error}</span>
          <button onClick={load}>נסה שוב</button>
        </div>
      )}

      {/* Grid */}
      <div className="crypto-grid">
        {loading ? (
          COINS.map(c => (
            <div key={c.id} className="crypto-card">
              <div className="crypto-card-icon">{c.icon}</div>
              <div className="crypto-card-sym">{c.sym}</div>
              <Skeleton />
            </div>
          ))
        ) : !error && coins.map(c => {
          const up = (c.change || 0) >= 0;
          return (
            <div key={c.id} className="crypto-card">
              <div className="crypto-card-icon">{c.icon}</div>
              <div className="crypto-card-name">{c.name}</div>
              <div className="crypto-card-sym">{c.sym}</div>
              <div className="crypto-card-price">
                {c.price ? `$${c.price.toLocaleString()}` : '—'}
              </div>
              <div className="crypto-card-change" style={{ color: up ? '#4ade80' : '#ef4444' }}>
                {c.change ? `${up ? '▲' : '▼'} ${Math.abs(c.change).toFixed(2)}%` : '—'}
              </div>
              {c.mcap && (
                <div className="crypto-card-mcap">{fmtMcap(c.mcap)}</div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
