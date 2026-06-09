import { useState, useEffect, useCallback, useRef } from 'react';
import IframeWithFallback from '../components/IframeWithFallback';
import './ModelBitPage.css';

const DEMO_POSITIONS = [
  { type: 'LONG', entry: 95400, current: null, pnl: null },
];

function getSignal(change) {
  if (change > 2)  return { label: 'BUY',  desc: 'מומנטום חיובי — מגמה עולה ב-4H',  cls: 'mb-sig-buy'  };
  if (change < -2) return { label: 'SELL', desc: 'לחץ מכירה גבוה — שמור על הסטופ',  cls: 'mb-sig-sell' };
  return             { label: 'HOLD', desc: 'שוק בדגימה — המתן לאישור כיוון',       cls: 'mb-sig-hold' };
}

function Skeleton({ w = '60%', h = '22px' }) {
  return <div className="mb-skeleton" style={{ width: w, height: h }} />;
}

export default function ModelBitPage() {
  const [btc, setBtc]             = useState(null);
  const [prev, setPrev]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [flash, setFlash]         = useState(null); // 'up' | 'down'
  const [live, setLive]           = useState(false);
  const intervalRef               = useRef(null);

  const fetchBtc = useCallback(() => {
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => r.json())
      .then(d => {
        const newPrice = parseFloat(d.lastPrice);
        setBtc(cur => {
          if (cur) {
            setPrev(cur.price);
            if (newPrice > cur.price) setFlash('up');
            else if (newPrice < cur.price) setFlash('down');
          }
          return {
            price:  newPrice,
            change: parseFloat(d.priceChangePercent),
            high:   parseFloat(d.highPrice),
            low:    parseFloat(d.lowPrice),
            vol:    parseFloat(d.quoteVolume),
          };
        });
        setLoading(false);
        setLive(true);
        setTimeout(() => setFlash(null), 700);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    fetchBtc();
    intervalRef.current = setInterval(fetchBtc, 15000);
    return () => clearInterval(intervalRef.current);
  }, [fetchBtc]);

  const sig      = btc ? getSignal(btc.change) : null;
  const up       = btc ? btc.change >= 0 : true;
  const position = btc ? { ...DEMO_POSITIONS[0], current: btc.price, pnl: ((btc.price - DEMO_POSITIONS[0].entry) / DEMO_POSITIONS[0].entry * 100).toFixed(2) } : null;

  const fmtPrice = (p) => p >= 1000 ? p.toLocaleString('en', { maximumFractionDigits: 0 }) : p.toFixed(2);

  return (
    <div className="mb-wrap">

      {/* Header */}
      <div className="mb-header">
        <div>
          <h2 className="mb-title">₿ Model BIT — Bitcoin Only</h2>
          <p className="mb-sub">מגמת 4H + כניסה 1H — ניתוח מולטי-טיימפריים</p>
        </div>
        <div className={`mb-status ${live ? 'mb-status--live' : ''}`}>
          <span className={`mb-dot ${live ? 'mb-dot--live' : ''}`} />
          {live ? 'LIVE' : 'מתחבר...'}
        </div>
      </div>

      {/* Demo banner */}
      <div className="mb-demo-banner">🔵 DEMO MODE — לא עסקאות אמיתיות</div>

      {/* Main BTC price card */}
      <div className={`mb-price-card${flash === 'up' ? ' mb-flash-up' : flash === 'down' ? ' mb-flash-down' : ''}`}>
        <div className="mb-price-card-top">
          <div className="mb-btc-icon">₿</div>
          <div>
            <div className="mb-btc-label">Bitcoin / USDT</div>
            <div className="mb-btc-sub">Binance Spot — עדכון כל 15 שניות</div>
          </div>
        </div>

        {loading ? (
          <div className="mb-price-skeleton">
            <Skeleton w="55%" h="48px" />
            <Skeleton w="30%" h="22px" />
          </div>
        ) : error ? (
          <div className="mb-err" onClick={fetchBtc}>⚠ שגיאת חיבור — לחץ לנסות שוב</div>
        ) : (
          <>
            <div className="mb-big-price">${fmtPrice(btc.price)}</div>
            <div className="mb-change-row">
              <span className="mb-change-24" style={{ color: up ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {up ? '▲' : '▼'} {Math.abs(btc.change).toFixed(2)}% — 24H
              </span>
            </div>
            <div className="mb-stats-row">
              <div className="mb-stat"><span className="mb-stat-label">24H גבוה</span><span className="mb-stat-val mb-stat-green">${fmtPrice(btc.high)}</span></div>
              <div className="mb-stat"><span className="mb-stat-label">24H נמוך</span><span className="mb-stat-val mb-stat-red">${fmtPrice(btc.low)}</span></div>
              <div className="mb-stat"><span className="mb-stat-label">Vol (USDT)</span><span className="mb-stat-val">${(btc.vol / 1e9).toFixed(2)}B</span></div>
            </div>
          </>
        )}
      </div>

      {/* Algo params */}
      <div className="mb-algo-bar">
        <span className="mb-algo-item"><span className="mb-algo-label">Stop</span><span className="mb-algo-val mb-red">1.5%</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Target</span><span className="mb-algo-val mb-green">4%</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Trade</span><span className="mb-algo-val mb-blue">$200</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Hold Max</span><span className="mb-algo-val">12H</span></span>
      </div>

      {/* Signal card */}
      {sig && (
        <div className={`mb-signal-card ${sig.cls}`}>
          <div className="mb-signal-badge">{sig.label}</div>
          <div className="mb-signal-desc">{sig.desc}</div>
        </div>
      )}

      {/* Positions table */}
      <div className="mb-section">
        <div className="mb-section-title">פוזיציות פתוחות (DEMO)</div>
        {!btc ? (
          <Skeleton w="100%" h="44px" />
        ) : (
          <div className="mb-table-wrap">
            <table className="mb-table">
              <thead>
                <tr>
                  <th>סוג</th>
                  <th>כניסה</th>
                  <th>נוכחי</th>
                  <th>P&amp;L%</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="mb-type-long">LONG</span></td>
                  <td>${fmtPrice(position.entry)}</td>
                  <td>${fmtPrice(position.current)}</td>
                  <td style={{ color: position.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                    {position.pnl >= 0 ? '+' : ''}{position.pnl}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TradingView BTC chart */}
      <div className="mb-chart-wrap">
        <div className="mb-chart-title">גרף BTC/USDT — 1H</div>
        <div className="mb-chart-container">
          <IframeWithFallback
            title="גרף BTC/USDT שעתי"
            src="https://s.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT&interval=60&theme=dark&locale=he_IL&toolbarbg=12121a"
            className="mb-chart-iframe"
          />
        </div>
      </div>

    </div>
  );
}
