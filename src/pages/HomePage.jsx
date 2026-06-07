import { useState, useEffect } from 'react';
import './HomePage.css';

function FearGreedCard() {
  const [val, setVal] = useState(null);
  const [lbl, setLbl] = useState('');

  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(d => {
        const v = parseInt(d?.data?.[0]?.value);
        const l = d?.data?.[0]?.value_classification || '';
        setVal(v); setLbl(l);
      })
      .catch(() => {});
  }, []);

  const color =
    val <= 20 ? '#c62828' :
    val <= 40 ? '#ef5350' :
    val <= 55 ? '#D4AF37' :
    val <= 75 ? '#66bb6a' : '#26a69a';

  return (
    <div className="hp-card">
      <div className="hp-card-title">Fear &amp; Greed — Crypto</div>
      <div className="hp-fng-val" style={{ color }}>{val ?? '—'}</div>
      <div className="hp-fng-lbl" style={{ color }}>{lbl || '...'}</div>
    </div>
  );
}

function MarketCard({ symbol, label }) {
  const [price, setPrice] = useState(null);
  const [change, setChange] = useState(null);

  useEffect(() => {
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`)
      .then(r => r.json())
      .then(d => {
        const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        if (closes.length >= 2) {
          const prev = closes[closes.length - 2];
          const curr = closes[closes.length - 1];
          setPrice(curr.toFixed(2));
          setChange(((curr - prev) / prev * 100).toFixed(2));
        }
      })
      .catch(() => {});
  }, [symbol]);

  const up = parseFloat(change) >= 0;
  return (
    <div className="hp-card">
      <div className="hp-card-title">{label}</div>
      <div className="hp-price">{price ? `$${price}` : '...'}</div>
      {change && (
        <div className="hp-change" style={{ color: up ? '#4ade80' : '#ef4444' }}>
          {up ? '▲' : '▼'} {Math.abs(change)}%
        </div>
      )}
    </div>
  );
}

export default function HomePage({ navigate }) {
  return (
    <div className="hp-wrap">

      {/* Welcome */}
      <div className="hp-welcome">
        <h2 className="hp-welcome-title">ברוך הבא ל-BEEP AI ⚡</h2>
        <p className="hp-welcome-sub">סורק מניות וקריפטו חכם — נתונים חיים, התראות בזמן אמת</p>
      </div>

      {/* Cards grid */}
      <div className="hp-grid">
        <FearGreedCard />
        <MarketCard symbol="BTC-USD"  label="Bitcoin" />
        <MarketCard symbol="^GSPC"    label="S&P 500" />
        <MarketCard symbol="GC=F"     label="Gold" />
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
        <button className="hp-action-btn hp-action-btn--ai" disabled>
          <span>🤖</span><span>BEEP AI <small>בקרוב</small></span>
        </button>
      </div>

    </div>
  );
}
