import { useState, useEffect, useCallback, useRef } from 'react';
import IframeWithFallback from '../components/IframeWithFallback';
import './ModelWPage.css';

const COINS = [
  { symbol: 'BTCUSDT',  name: 'Bitcoin',  short: 'BTC',  color: '#F7931A' },
  { symbol: 'ETHUSDT',  name: 'Ethereum', short: 'ETH',  color: '#627EEA' },
  { symbol: 'SOLUSDT',  name: 'Solana',   short: 'SOL',  color: '#9945FF' },
  { symbol: 'BNBUSDT',  name: 'BNB',      short: 'BNB',  color: '#F3BA2F' },
];

function getSignal(change) {
  if (change > 2)  return { label: 'BUY',  cls: 'sig-buy'  };
  if (change < -2) return { label: 'SELL', cls: 'sig-sell' };
  return             { label: 'HOLD', cls: 'sig-hold' };
}

function tvSymbol(short) {
  return `BINANCE:${short}USDT`;
}

function Skeleton({ w = '60%', h = '22px' }) {
  return <div className="mw-skeleton" style={{ width: w, height: h }} />;
}

function CoinCard({ coin, onSelect, selected }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin.symbol}`)
      .then(r => r.json())
      .then(d => {
        setData({
          price:  parseFloat(d.lastPrice),
          change: parseFloat(d.priceChangePercent),
          high:   parseFloat(d.highPrice),
          low:    parseFloat(d.lowPrice),
          vol:    parseFloat(d.volume),
        });
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [coin.symbol]);

  useEffect(() => { load(); }, [load]);

  const sig = data ? getSignal(data.change) : null;
  const up  = data ? data.change >= 0 : true;

  return (
    <div
      className={`mw-coin-card${selected ? ' mw-coin-card--active' : ''}`}
      onClick={() => onSelect(coin)}
      style={{ '--coin-color': coin.color }}
    >
      <div className="mw-coin-top">
        <div className="mw-coin-avatar" style={{ background: coin.color + '22', color: coin.color }}>
          {coin.short.charAt(0)}
        </div>
        <div className="mw-coin-info">
          <div className="mw-coin-name">{coin.short}</div>
          <div className="mw-coin-full">{coin.name}</div>
        </div>
        {sig && <div className={`mw-signal ${sig.cls}`}>{sig.label}</div>}
      </div>

      <div className="mw-coin-body">
        {loading ? (
          <>
            <Skeleton w="70%" h="26px" />
            <Skeleton w="40%" h="16px" />
          </>
        ) : error ? (
          <div className="mw-err" onClick={e => { e.stopPropagation(); load(); }}>⚠ נסה שוב</div>
        ) : (
          <>
            <div className="mw-price">
              ${data.price >= 1000
                ? data.price.toLocaleString('en', { maximumFractionDigits: 0 })
                : data.price.toFixed(2)}
            </div>
            <div className="mw-change" style={{ color: up ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {up ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ModelWPage() {
  const [selected, setSelected]     = useState(COINS[0]);
  const [scanTime, setScanTime]      = useState('');
  const [refreshKey, setRefreshKey]  = useState(0);
  const [live, setLive]              = useState(false);

  useEffect(() => {
    const t = new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setScanTime(t);
    const timer = setTimeout(() => setLive(true), 1200);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  const refresh = () => {
    setLive(false);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="mw-wrap">

      {/* Header */}
      <div className="mw-header">
        <div>
          <h2 className="mw-title">🤖 Model W — סורק קריפטו</h2>
          <p className="mw-sub">סריקת אסטרטגיה אוטומטית — Binance LIVE</p>
        </div>
        <div className="mw-header-actions">
          <div className={`mw-status ${live ? 'mw-status--live' : ''}`}>
            <span className={`mw-dot ${live ? 'mw-dot--live' : ''}`} />
            {live ? 'LIVE' : 'מתחבר...'}
          </div>
          <button className="mw-refresh-btn" onClick={refresh}>↻ רענן</button>
        </div>
      </div>

      {/* Simulation banner */}
      <div className="mw-sim-banner">
        ⚠️ מצב סימולציה — לא עסקאות אמיתיות
      </div>

      {/* Algo params */}
      <div className="mw-algo-bar">
        <span className="mw-algo-item"><span className="mw-algo-label">Target</span><span className="mw-algo-val mw-algo-green">4%</span></span>
        <span className="mw-algo-sep" />
        <span className="mw-algo-item"><span className="mw-algo-label">Stop</span><span className="mw-algo-val mw-algo-red">2%</span></span>
        <span className="mw-algo-sep" />
        <span className="mw-algo-item"><span className="mw-algo-label">Trade</span><span className="mw-algo-val mw-algo-blue">$300</span></span>
        {scanTime && <span className="mw-scan-time">סריקה: {scanTime}</span>}
      </div>

      {/* Coin grid */}
      <div className="mw-grid" key={refreshKey}>
        {COINS.map(c => (
          <CoinCard
            key={c.symbol}
            coin={c}
            selected={selected?.symbol === c.symbol}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* TradingView chart */}
      {selected && (
        <div className="mw-chart-wrap">
          <div className="mw-chart-title">
            גרף {selected.short} — 1H
          </div>
          <div className="mw-chart-container">
            <IframeWithFallback
              iframeKey={selected.symbol}
              title={`גרף ${selected.short} שעתי`}
              src={`https://s.tradingview.com/widgetembed/?symbol=${tvSymbol(selected.short)}&interval=60&theme=dark&locale=he_IL&toolbarbg=12121a&hide_top_toolbar=0&hide_legend=0&saveimage=0`}
              className="mw-chart-iframe"
            />
          </div>
        </div>
      )}

    </div>
  );
}
