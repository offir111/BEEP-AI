import { useState, useEffect, useContext, useRef } from 'react';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import AlertChartPanel from '../components/AlertChartPanel';
import RobotNavTabs from '../components/RobotNavTabs';
import './ModelWPage.css';

const PERF_URL = 'https://raw.githubusercontent.com/offir111/model-w/master/data/performance_log.json';

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
  const lqCtx = useContext(LiveQuoteContext);
  const { price, change, high, low, flash } = useQuote(coin.short);

  useEffect(() => {
    if (!lqCtx) return;
    lqCtx.subscribe([coin.short]);
    return () => lqCtx.unsubscribe([coin.short]);
  }, [coin.short, lqCtx]);

  const data    = price != null ? { price, change, high, low, vol: null } : null;
  const loading = price == null;
  const error   = false;

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
          <div className="mw-err">⚠ מתחבר...</div>
        ) : (
          <>
            <div className={`mw-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>
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

export default function ModelWPage({ navigate }) {
  const [selected, setSelected]     = useState(COINS[0]);
  const [scanTime, setScanTime]      = useState('');
  const [refreshKey, setRefreshKey]  = useState(0);
  const [live, setLive]              = useState(false);

  // Performance log from GitHub
  const [perf, setPerf]     = useState(null);
  const [perfErr, setPerfErr] = useState(false);

  useEffect(() => {
    const t = new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setScanTime(t);
    const timer = setTimeout(() => setLive(true), 1200);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  // Fetch performance log
  useEffect(() => {
    fetch(PERF_URL + '?t=' + Date.now())
      .then(r => r.json())
      .then(data => {
        const trades = Array.isArray(data) ? data : (data.trades || data.history || []);
        const wins   = trades.filter(t => t.result === 'win' || t.pnl_usd > 0).length;
        const losses = trades.filter(t => t.result === 'loss' || t.pnl_usd < 0).length;
        const total  = wins + losses;
        const pnl    = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
        const wr     = total > 0 ? ((wins / total) * 100).toFixed(1) : '—';
        // last 7 days
        const week   = trades.filter(t => t.close_time && Date.now() - new Date(t.close_time) < 7*86400000);
        const weekPnl = week.reduce((s, t) => s + (t.pnl_usd || 0), 0);
        setPerf({ wins, losses, total, pnl, wr, weekPnl, lastTrade: trades[trades.length-1] });
      })
      .catch(() => setPerfErr(true));
  }, [refreshKey]);

  const refresh = () => {
    setLive(false);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="mw-wrap">

      <RobotNavTabs currentPage="model-w" navigate={navigate} />

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

      {/* Purpose banner */}
      <div className="mw-sim-banner">
        🤖 Model W עוקב בזמן אמת אחר BTC · ETH · SOL · BNB מ-Binance ומפיק איתות קנייה/החזקה/מכירה לפי תנופת המחיר (יעד 4% · סטופ 2%)
      </div>

      {/* Performance stats from GitHub */}
      {perf && !perfErr && (
        <div className="mw-perf-bar">
          <span className="mw-perf-item"><span className="mw-perf-label">Win Rate</span><span className="mw-perf-val" style={{color:'#4ade80'}}>{perf.wr}%</span></span>
          <span className="mw-perf-sep"/>
          <span className="mw-perf-item"><span className="mw-perf-label">Wins</span><span className="mw-perf-val" style={{color:'#4ade80'}}>{perf.wins}</span></span>
          <span className="mw-perf-sep"/>
          <span className="mw-perf-item"><span className="mw-perf-label">Losses</span><span className="mw-perf-val" style={{color:'#ef4444'}}>{perf.losses}</span></span>
          <span className="mw-perf-sep"/>
          <span className="mw-perf-item"><span className="mw-perf-label">P&L כולל</span><span className="mw-perf-val" style={{color:perf.pnl>=0?'#4ade80':'#ef4444'}}>${perf.pnl>=0?'+':''}{perf.pnl.toFixed(0)}</span></span>
          <span className="mw-perf-sep"/>
          <span className="mw-perf-item"><span className="mw-perf-label">7 ימים</span><span className="mw-perf-val" style={{color:perf.weekPnl>=0?'#4ade80':'#ef4444'}}>${perf.weekPnl>=0?'+':''}{perf.weekPnl.toFixed(0)}</span></span>
        </div>
      )}

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
            <AlertChartPanel symbol={selected.short} isCrypto defaultTf="1h" />
          </div>
        </div>
      )}

    </div>
  );
}
