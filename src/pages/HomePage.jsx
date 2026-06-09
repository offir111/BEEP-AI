import { useState, useEffect, useCallback } from 'react';
import './HomePage.css';

// ── Skeleton loader ───────────────────────────────────────────
function Skeleton() {
  return <div className="skeleton" />;
}

// ── Fear & Greed Card ─────────────────────────────────────────
// BUG-03: FearGreedCard now has error state + retry button
function FearGreedCard() {
  const [val,     setVal]     = useState(null);
  const [lbl,     setLbl]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(d => {
        const v = parseInt(d?.data?.[0]?.value);
        const l = d?.data?.[0]?.value_classification || '';
        if (!isNaN(v)) { setVal(v); setLbl(l); } else { setError(true); }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const color =
    !val ? '#888' :
    val <= 20 ? '#c62828' :
    val <= 40 ? '#ef5350' :
    val <= 55 ? '#D4AF37' :
    val <= 75 ? '#66bb6a' : '#26a69a';

  return (
    <div className="hp-card">
      <div className="hp-card-title">Fear &amp; Greed</div>
      {loading ? <Skeleton /> : error ? (
        <div className="hp-card-err" onClick={load} title="לחץ לנסות שוב" role="button" aria-label="טעינה נכשלה — לחץ לנסות שוב">
          ⚠️ נסה שוב
        </div>
      ) : (
        <>
          <div className="hp-fng-val" style={{ color }}>{val ?? '—'}</div>
          <div className="hp-fng-lbl" style={{ color }}>{lbl || '...'}</div>
        </>
      )}
    </div>
  );
}

// ── Market Card (uses server-side proxy) ──────────────────────
function MarketCard({ symbol, label, prefix = '$' }) {
  const [price,   setPrice]   = useState(null);
  const [change,  setChange]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => {
        if (d.price !== null) {
          setPrice(d.price);
          setChange(d.change);
        } else {
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const up = (change || 0) >= 0;

  return (
    <div className="hp-card">
      <div className="hp-card-title">{label}</div>
      {loading ? <Skeleton /> : error ? (
        <div className="hp-card-err" onClick={load} title="לחץ לנסות שוב">⚠️ נסה שוב</div>
      ) : (
        <>
          <div className="hp-price">
            {price ? `${prefix}${price.toLocaleString()}` : '—'}
          </div>
          {change !== null && (
            <div className="hp-change" style={{ color: up ? '#4ade80' : '#ef4444' }}>
              {up ? '▲' : '▼'} {Math.abs(change)}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────
export default function HomePage({ navigate }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdate, setLastUpdate] = useState('');

  const refresh = () => {
    setRefreshKey(k => k + 1);
    setLastUpdate(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit'
    }));
  };

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit'
    }));
  }, []);

  return (
    <div className="hp-wrap">

      {/* Welcome */}
      <div className="hp-welcome">
        <div className="hp-welcome-top">
          <div>
            <h2 className="hp-welcome-title">ברוך הבא ל-BEEP AI ⚡</h2>
            <p className="hp-welcome-sub">סורק מניות וקריפטו חכם — נתונים חיים, התראות בזמן אמת</p>
          </div>
          <button className="hp-refresh-btn" onClick={refresh} title="רענן נתונים">
            ↻ רענן
          </button>
        </div>
        {lastUpdate && <div className="hp-last-update">עדכון אחרון: {lastUpdate}</div>}
      </div>

      {/* Cards grid */}
      <div className="hp-grid" key={refreshKey}>
        <FearGreedCard />
        <MarketCard symbol="BTC-USD"  label="Bitcoin" />
        <MarketCard symbol="^GSPC"    label="S&P 500" />
        <MarketCard symbol="XAUUSD=X"  label="Gold" />
      </div>

      {/* Quick actions */}
      <div className="hp-actions-title">גישה מהירה</div>
      <div className="hp-actions">
        <button className="hp-action-btn" onClick={() => navigate('charts')}>
          <span>📈</span><span>פתח גרף</span>
        </button>
        <button className="hp-action-btn" onClick={() => navigate('crypto')}>
          <span>₿</span><span>קריפטו LIVE</span>
        </button>
        <button className="hp-action-btn" onClick={() => navigate('news')}>
          <span>📰</span><span>חדשות שוק</span>
        </button>
        <button className="hp-action-btn hp-action-btn--ai" onClick={() => navigate('sot')}>
          <span>🤖</span>
          <span>BEEP AI</span>
          <small>סריקה חכמה</small>
        </button>
      </div>

    </div>
  );
}
