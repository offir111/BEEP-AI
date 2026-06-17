import { useState, useEffect, useContext } from 'react';
import { useAlerts } from '../context/AlertsContext';
import ScannerWidget  from '../components/ScannerWidget';
import MiniChartPanel from '../components/MiniChartPanel';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import FngIndicator from '../components/FngIndicator';
import './HomePage.css';
import '../components/LivePrice.css';

// ── Small market pill ─────────────────────────────────────────
function MarketPill({ sym, label, prefix = '$' }) {
  const ctx = useContext(LiveQuoteContext);
  const { price, change, flash } = useQuote(sym);

  useEffect(() => {
    ctx?.subscribe([sym]);
    return () => ctx?.unsubscribe([sym]);
  }, [sym, ctx]);

  const up = (change || 0) >= 0;
  return (
    <div className="hp-pill">
      <span className="hp-pill-label">{label}</span>
      {price != null
        ? <>
            <span className={`hp-pill-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>
              {prefix}{price.toLocaleString('en', { maximumFractionDigits: price < 10 ? 2 : 0 })}
            </span>
            <span className="hp-pill-change" style={{ color: up ? '#4ade80' : '#f87171' }}>
              {up ? '▲' : '▼'}{Math.abs(change).toFixed(1)}%
            </span>
          </>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Fear & Greed — Crypto (alternative.me) ────────────────────
function FearGreedCrypto() {
  const [val, setVal] = useState(null);
  const [lbl, setLbl] = useState('');
  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(d => { setVal(parseInt(d?.data?.[0]?.value)); setLbl(d?.data?.[0]?.value_classification || ''); })
      .catch(() => {});
  }, []);
  const color = !val ? '#888' : val <= 25 ? '#ef4444' : val <= 45 ? '#f97316' : val <= 55 ? '#eab308' : val <= 75 ? '#84cc16' : '#22c55e';
  return (
    <div className="hp-pill hp-pill--fng">
      <span className="hp-pill-label">F&amp;G ₿</span>
      {val
        ? <><span className="hp-pill-price" style={{ color }}>{val}</span><span className="hp-pill-change" style={{ color, fontSize: '0.62rem' }}>{lbl}</span></>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Fear & Greed — Stocks (CNN) ───────────────────────────────
function FearGreedStocks() {
  const [val, setVal] = useState(null);
  const [lbl, setLbl] = useState('');
  useEffect(() => {
    fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata')
      .then(r => r.json())
      .then(d => {
        const score = Math.round(d?.fear_and_greed?.score ?? d?.score ?? NaN);
        const rating = d?.fear_and_greed?.rating ?? d?.rating ?? '';
        if (!isNaN(score)) { setVal(score); setLbl(rating); }
      })
      .catch(() => {});
  }, []);
  const color = !val ? '#888' : val <= 25 ? '#ef4444' : val <= 45 ? '#f97316' : val <= 55 ? '#eab308' : val <= 75 ? '#84cc16' : '#22c55e';
  return (
    <div className="hp-pill hp-pill--fng">
      <span className="hp-pill-label">F&amp;G 📈</span>
      {val
        ? <><span className="hp-pill-price" style={{ color }}>{val}</span><span className="hp-pill-change" style={{ color, fontSize: '0.62rem' }}>{lbl}</span></>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── BTC Signal pill ───────────────────────────────────────────
function BtcSignalPill() {
  const ctx = useContext(LiveQuoteContext);
  const { change, flash } = useQuote('BTC');
  useEffect(() => {
    ctx?.subscribe(['BTC']);
    return () => ctx?.unsubscribe(['BTC']);
  }, [ctx]);
  const up = change == null ? null : change >= 0;
  const signal = up === null ? null : up ? 'קנה' : 'מכור';
  const color  = up === null ? '#888' : up ? '#4ade80' : '#ef4444';
  const arrow  = up === null ? '' : up ? '▲' : '▼';
  return (
    <div className="hp-pill">
      <span className="hp-pill-label">BTC</span>
      {signal
        ? <>
            <span className={`hp-pill-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}
              style={{ color }}>{arrow} {signal}</span>
            {change != null && <span className="hp-pill-change" style={{ color }}>{Math.abs(change).toFixed(1)}%</span>}
          </>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Robot card ────────────────────────────────────────────────
function RobotCard({ icon, name, desc, tag, tagColor, onClick }) {
  return (
    <button className="hp-robot-card" onClick={onClick}>
      <div className="hp-robot-top">
        <div className="hp-robot-icon">{icon}</div>
        <span className="hp-robot-tag" style={{ color: tagColor, borderColor: tagColor + '55', background: tagColor + '18' }}>
          {tag}
        </span>
      </div>
      <div className="hp-robot-info">
        <div className="hp-robot-name">{name}</div>
        <div className="hp-robot-desc">{desc}</div>
      </div>
    </button>
  );
}

// ── Crypto strip — 4 live price cards (Binance WebSocket) ──
const LS_SYMBOL_KEY = 'beepai_chart_sym';
const LS_LAST_KEY   = 'beepai_last_searched';
const STRIP_SYMS    = ['BTC', 'ETH', 'SOL', 'BNB'];
const COIN_ICON     = { BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: '⬡' };

function fmtLive(p) {
  if (p == null) return '…';
  if (p >= 10000) return p.toLocaleString('en', { maximumFractionDigits: 0 });
  if (p >= 1000)  return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 100)   return p.toFixed(1);
  if (p >= 1)     return p.toFixed(2);
  return p.toFixed(4);
}

function MiniLiveCard({ sym, selected, onSelect, dayOpen }) {
  const ctx = useContext(LiveQuoteContext);
  const { price, flash } = useQuote(sym);

  useEffect(() => {
    if (!ctx) return;
    ctx.subscribe([sym]);
    return () => ctx.unsubscribe([sym]);
  }, [sym, ctx]);

  const dailyChange = (price != null && dayOpen != null && dayOpen !== 0)
    ? ((price - dayOpen) / dayOpen) * 100
    : null;

  const up       = (dailyChange ?? 0) >= 0;
  const priceCls = flash === 'up' ? ' hp-price-up' : flash === 'down' ? ' hp-price-dn' : '';
  const activeCls = selected === sym ? ' hp-mini-active' : '';

  return (
    <div
      className={`hp-mini-card${activeCls}`}
      onClick={() => onSelect(sym)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(sym)}
    >
      <span className="hp-mini-sym">{sym}</span>
      <span key={price} className={`hp-mini-price${priceCls}`}>${fmtLive(price)}</span>
      {dailyChange != null && (
        <span className="hp-mini-pct" style={{ color: up ? '#4ade80' : '#f87171' }}>
          {up ? '+' : ''}{dailyChange.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function CryptoStrip({ selected, onSelect }) {
  const [dayOpens, setDayOpens] = useState({});

  useEffect(() => {
    // Fetch today's daily open from Binance klines — matches TradingView's 1D %
    Promise.all(
      STRIP_SYMS.map(sym =>
        fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1d&limit=1`)
          .then(r => r.json())
          .then(data => ({ sym, open: parseFloat(data[0][1]) }))
          .catch(() => ({ sym, open: null }))
      )
    ).then(results => {
      const opens = {};
      results.forEach(({ sym, open }) => { opens[sym] = open; });
      setDayOpens(opens);
    });
  }, []);

  return (
    <div className="hp-crypto-strip">
      {STRIP_SYMS.map(sym => (
        <MiniLiveCard key={sym} sym={sym} selected={selected} onSelect={onSelect}
          dayOpen={dayOpens[sym] ?? null} />
      ))}
    </div>
  );
}

// ── Stock strip — top gainer + QQQ + S&P + SPCX ──────────────
const STOCK_POLL_MAP = { QQQ: 'QQQ', 'S&P': '^GSPC', SPCX: 'SPCX' };

function StockMiniCard({ sym, price, change, isTop, selected, onSelect }) {
  const up = (change ?? 0) >= 0;
  const clickable = !!sym && typeof onSelect === 'function';
  const activeCls = selected && sym && selected === sym ? ' hp-mini-active' : '';
  return (
    <div
      className={`hp-mini-card${isTop ? ' hp-mini-card--top' : ''}${activeCls}`}
      onClick={clickable ? () => onSelect(sym) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e => e.key === 'Enter' && onSelect(sym)) : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
      title={clickable ? `הצג גרף ${sym}` : undefined}
    >
      <span className="hp-mini-sym" style={isTop ? { color: '#f59e0b' } : undefined}>
        {isTop && sym ? '▲ ' : ''}{sym || '…'}
      </span>
      <span className="hp-mini-price">{price != null ? `$${fmtLive(price)}` : '…'}</span>
      {change != null && (
        <span className="hp-mini-pct" style={{ color: up ? '#4ade80' : '#f87171' }}>
          {up ? '+' : ''}{change.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function StockStrip({ selected, onSelect }) {
  const [gainer, setGainer] = useState({ sym: '', price: null, change: null });
  const [stocks, setStocks] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/tv-screener?period=1d');
        const d = await r.json();
        if (d.quotes?.length) {
          const t = d.quotes[0];
          setGainer({ sym: t.symbol, price: t.price, change: t.chg1d });
        }
      } catch {}
      await Promise.all(
        Object.entries(STOCK_POLL_MAP).map(([sym, apiSym]) =>
          fetch(`/api/market?symbol=${encodeURIComponent(apiSym)}`)
            .then(r => r.json())
            .then(d => {
              if (d.price != null)
                setStocks(prev => ({ ...prev, [sym]: { price: d.price, change: d.changePercent } }));
            })
            .catch(() => {})
        )
      );
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="hp-crypto-strip">
      <StockMiniCard sym={gainer.sym} price={gainer.price} change={gainer.change} isTop selected={selected} onSelect={onSelect} />
      <StockMiniCard sym="QQQ"  price={stocks.QQQ?.price}    change={stocks.QQQ?.change}    selected={selected} onSelect={onSelect} />
      <StockMiniCard sym="S&P"  price={stocks['S&P']?.price}  change={stocks['S&P']?.change}  selected={selected} onSelect={onSelect} />
      <StockMiniCard sym="SPCX" price={stocks.SPCX?.price}   change={stocks.SPCX?.change}   selected={selected} onSelect={onSelect} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function HomePage({ navigate }) {
  const { alerts } = useAlerts();
  const activeAlerts = alerts.filter(a => !a.triggered).length;

  /* Selected chart symbol — persisted */
  const [chartSymbol, setChartSymbol] = useState(
    () => localStorage.getItem(LS_SYMBOL_KEY) || 'BTC'
  );

  const handleSymbolSelect = (sym) => {
    setChartSymbol(sym);
    localStorage.setItem(LS_SYMBOL_KEY, sym);
  };

  const handleSearch = (sym) => {
    localStorage.setItem(LS_LAST_KEY, sym);
    handleSymbolSelect(sym);
  };

  return (
    <div className="hp-wrap" dir="rtl">

      {/* ── Market strip — ABOVE the chart ── */}
      {/* Order (RTL: first=visual-right → last=visual-left):
          גרפים | S&P | GOLD | ETH | SOL | [empty] | BTC-Signal | F&G-Crypto | F&G-Stocks */}
      <div className="hp-market-strip">
        {/* GAINERS (right) → real-time gainers page */}
        <button className="hp-gainers-btn" onClick={() => navigate('gainers')}>
          <span className="hp-gainers-title">GAINERS</span>
        </button>

        {/* Heatmap (middle) — treemap sketch, opens heatmap page */}
        <button className="hp-heatmap-btn" onClick={() => navigate('heatmap')} aria-label="מפת חום">
          <svg className="hp-heatmap-svg" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0"  y="0" width="30" height="18" fill="#991b1b"/>
            <rect x="31" y="0" width="22" height="18" fill="#16a34a"/>
            <rect x="54" y="0" width="20" height="18" fill="#dc2626"/>
            <rect x="75" y="0" width="25" height="18" fill="#22c55e"/>
          </svg>
          <span className="hp-heatmap-label">HIT MAP</span>
        </button>

        {/* Fear & Greed (left) — split crypto | stock, opens gauge */}
        <FngIndicator />
      </div>

      {/* ── SOT Scanner Widget ── */}
      <ScannerWidget onSearch={handleSearch} />

      {/* ── Mini chart panel ── */}
      <MiniChartPanel navigate={navigate} symbol={chartSymbol} />

      {/* ── 4 crypto mini cards ── */}
      <CryptoStrip selected={chartSymbol} onSelect={handleSymbolSelect} />
      {/* ── 4 stock mini cards ── */}
      <StockStrip selected={chartSymbol} onSelect={handleSymbolSelect} />

      {/* ── Robots section ── */}
      <div className="hp-section-title">🤖 סקנרים &amp; רובוטים</div>
      <div className="hp-robots">
        <RobotCard icon="🛰️" name="TGM — סורק לידים" desc="מעקב ודירוג ספקי לידים" tag="LIVE" tagColor="#22d3ee" onClick={() => navigate('tgm')} />
        <RobotCard icon="⚙️" name="Model W"    desc="קריפטו — BTC/ETH/SOL"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-w')} />
        <RobotCard icon="₿"  name="Model BIT"  desc="Bitcoin — 4H+1H"         tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-bit')} />
        <RobotCard icon="📐" name="Model SMC"  desc="Smart Money מוסדי"       tag="אנליזה" tagColor="#a78bfa" onClick={() => navigate('model-smc')} />
        <RobotCard icon="📊" name="FINVIZ"     desc="9 תבניות ריוורסל"        tag="סריקה" tagColor="#f59e0b" onClick={() => navigate('finviz')} />
        <RobotCard icon="📋" name="eToro"      desc="קופי טריידינג"            tag="Demo"  tagColor="#94a3b8" onClick={() => navigate('etoro')} />
        <RobotCard icon="📐" name="Model Grid"  desc="גריד BTC — רמות קנייה"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-grid')} />
        <RobotCard icon="🗞️" name="Daily AI"   desc="חדשות מדורגות AI"         tag="אצור"  tagColor="#94a3b8" onClick={() => navigate('daily')} />
      </div>

    </div>
  );
}
