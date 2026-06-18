import { useState, useEffect, useContext, useRef } from 'react';
import { useAlerts } from '../context/AlertsContext';
import ScannerWidget  from '../components/ScannerWidget';
import MiniChartPanel from '../components/MiniChartPanel';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import FngIndicator from '../components/FngIndicator';
import { apiUrl } from '../utils/apiBase';
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
const COIN_ICON     = { BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: '⬡' };

// Editable tile slots (long-press to change). BTC + the daily gainer stay fixed.
const LS_CRYPTO_TILES = 'beepai_crypto_tiles';
const LS_STOCK_TILES  = 'beepai_stock_tiles';
const DEFAULT_CRYPTO  = ['ETH', 'SOL', 'BNB'];   // editable; BTC fixed (rightmost)
const DEFAULT_STOCK   = ['QQQ', 'S&P', 'SPCX'];  // editable; gainer fixed (rightmost)
const STOCK_API_ALIAS = { 'S&P': '^GSPC', SP500: '^GSPC', GOLD: 'GC=F' };
const LONG_PRESS_MS   = 1000;                    // >1s opens edit mode

function loadSlots(key, def) {
  try {
    const s = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(s) && s.length === def.length) return s.map(x => String(x).toUpperCase());
  } catch { /* ignore */ }
  return [...def];
}
function saveSlots(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* ignore */ } }

function fmtLive(p) {
  if (p == null) return '…';
  if (p >= 10000) return p.toLocaleString('en', { maximumFractionDigits: 0 });
  if (p >= 1000)  return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 100)   return p.toFixed(1);
  if (p >= 1)     return p.toFixed(2);
  return p.toFixed(4);
}

// Inline editor shown in a tile while changing its symbol.
function EditCell({ initial, onCommit, onCancel }) {
  const ref = useRef(null);
  const [val, setVal] = useState(initial || '');
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 50); return () => clearTimeout(t); }, []);
  return (
    <div className="hp-stock-edit-wrap">
      <input
        ref={ref}
        className="hp-stock-edit-input"
        value={val}
        onChange={e => setVal(e.target.value.toUpperCase())}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(val); if (e.key === 'Escape') onCancel(); }}
        maxLength={8}
        placeholder={initial}
        aria-label="שם מניה/מטבע חדש"
      />
      <button className="hp-stock-edit-ok" onClick={() => onCommit(val)} aria-label="אישור">✓</button>
    </div>
  );
}

// Shared long-press hook: fires onLongPress after LONG_PRESS_MS; suppresses the click that follows.
function useLongPress(onLongPress) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = () => {
    if (!onLongPress) return;
    fired.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { fired.current = true; onLongPress(); }, LONG_PRESS_MS);
  };
  const end = () => clearTimeout(timer.current);
  return { fired, start, end };
}

function MiniLiveCard({ sym, selected, onSelect, dayOpen, fbPrice, fbChange, onLongPress }) {
  const ctx = useContext(LiveQuoteContext);
  const { price: wsPrice, flash } = useQuote(sym);
  const { fired, start, end } = useLongPress(onLongPress);

  useEffect(() => {
    if (!ctx) return;
    ctx.subscribe([sym]);
    return () => ctx.unsubscribe([sym]);
  }, [sym, ctx]);

  // WebSocket is the real-time primary; the server proxy fills in when the browser
  // can't reach Binance (region block) so the tile never goes blank.
  const price = wsPrice ?? fbPrice ?? null;

  const dailyChange = (price != null && dayOpen != null && dayOpen !== 0)
    ? ((price - dayOpen) / dayOpen) * 100
    : (fbChange ?? null);

  const up       = (dailyChange ?? 0) >= 0;
  const priceCls = flash === 'up' ? ' hp-price-up' : flash === 'down' ? ' hp-price-dn' : '';
  const activeCls = selected === sym ? ' hp-mini-active' : '';

  const handleClick = () => { if (fired.current) { fired.current = false; return; } onSelect(sym); };

  return (
    <div
      className={`hp-mini-card${activeCls}`}
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(sym)}
      title={onLongPress ? 'לחיצה ארוכה לעריכה' : undefined}
    >
      {onLongPress && <span className="hp-stock-pencil" aria-hidden="true">✎</span>}
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
  const [editable, setEditable]   = useState(() => loadSlots(LS_CRYPTO_TILES, DEFAULT_CRYPTO));
  const [editingIdx, setEditing]  = useState(null);
  const [dayOpens, setDayOpens]   = useState({});
  const [fb, setFb]               = useState({});   // server-proxy fallback: { sym: { price, open, changePct } }

  const syms    = ['BTC', ...editable];   // BTC fixed (index 0 = rightmost in RTL)
  const symsKey = syms.join(',');

  useEffect(() => {
    // Today's daily open from Binance klines (direct; may be region-blocked → proxy covers it).
    let cancelled = false;
    Promise.all(
      syms.map(sym =>
        fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1d&limit=1`)
          .then(r => r.json())
          .then(data => ({ sym, open: parseFloat(data[0][1]) }))
          .catch(() => ({ sym, open: null }))
      )
    ).then(results => {
      if (cancelled) return;
      setDayOpens(prev => {
        const next = { ...prev };
        results.forEach(({ sym, open }) => { next[sym] = open; });
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [symsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Server-side fallback (reachable when the browser can't hit Binance directly).
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(apiUrl(`/api/crypto-price?symbols=${symsKey}`));
        const d = await r.json();
        if (!cancelled && d?.prices) setFb(prev => ({ ...prev, ...d.prices }));
      } catch { /* keep last */ }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [symsKey]);

  const commit = (val) => {
    const s = String(val || '').trim().toUpperCase();
    if (s && editingIdx != null) {
      const next = [...editable]; next[editingIdx] = s;
      setEditable(next); saveSlots(LS_CRYPTO_TILES, next);
    }
    setEditing(null);
  };

  return (
    <div className="hp-crypto-strip">
      {/* BTC — fixed (rightmost) */}
      <MiniLiveCard sym="BTC" selected={selected} onSelect={onSelect}
        dayOpen={dayOpens.BTC ?? fb.BTC?.open ?? null}
        fbPrice={fb.BTC?.price ?? null} fbChange={fb.BTC?.changePct ?? null} />

      {/* 3 editable crypto tiles */}
      {editable.map((sym, i) => editingIdx === i ? (
        <EditCell key={`edit-${i}`} initial={sym} onCommit={commit} onCancel={() => setEditing(null)} />
      ) : (
        <MiniLiveCard key={`${sym}-${i}`} sym={sym} selected={selected} onSelect={onSelect}
          dayOpen={dayOpens[sym] ?? fb[sym]?.open ?? null}
          fbPrice={fb[sym]?.price ?? null} fbChange={fb[sym]?.changePct ?? null}
          onLongPress={() => setEditing(i)} />
      ))}
    </div>
  );
}

// ── Stock strip — daily gainer (fixed) + 3 editable tiles ────
function StockMiniCard({ sym, price, change, isTop, selected, onSelect, onLongPress }) {
  const up = (change ?? 0) >= 0;
  const clickable = !!sym && typeof onSelect === 'function';
  const activeCls = selected && sym && selected === sym ? ' hp-mini-active' : '';
  const { fired, start, end } = useLongPress(onLongPress);

  const handleClick = () => {
    if (fired.current) { fired.current = false; return; }
    if (clickable) onSelect(sym);
  };

  return (
    <div
      className={`hp-mini-card${isTop ? ' hp-mini-card--top' : ''}${activeCls}`}
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e => e.key === 'Enter' && onSelect(sym)) : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
      title={onLongPress ? 'לחיצה ארוכה לעריכה' : (clickable ? `הצג גרף ${sym}` : undefined)}
    >
      {onLongPress && <span className="hp-stock-pencil" aria-hidden="true">✎</span>}
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
  const [editable, setEditable]  = useState(() => loadSlots(LS_STOCK_TILES, DEFAULT_STOCK));
  const [editingIdx, setEditing] = useState(null);
  const [gainer, setGainer]      = useState({ sym: '', price: null, change: null });
  const [stocks, setStocks]      = useState({});

  const editKey = editable.join(',');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Daily gainer — fixed tile
      try {
        const r = await fetch(apiUrl('/api/tv-screener?period=1d'));
        const d = await r.json();
        if (!cancelled && d.quotes?.length) {
          const t = d.quotes[0];
          setGainer({ sym: t.symbol, price: t.price, change: t.chg1d });
        }
      } catch { /* keep last */ }
      // Editable stock tiles
      await Promise.all(editable.map(async (sym) => {
        const apiSym = STOCK_API_ALIAS[sym] || sym;
        try {
          const r = await fetch(apiUrl(`/api/market?symbol=${encodeURIComponent(apiSym)}`));
          const d = await r.json();
          if (!cancelled && d.price != null)
            setStocks(prev => ({ ...prev, [sym]: { price: d.price, change: d.changePercent } }));
        } catch { /* keep last */ }
      }));
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [editKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (val) => {
    const s = String(val || '').trim().toUpperCase();
    if (s && editingIdx != null) {
      const next = [...editable]; next[editingIdx] = s;
      setEditable(next); saveSlots(LS_STOCK_TILES, next);
    }
    setEditing(null);
  };

  return (
    <div className="hp-crypto-strip">
      {/* Daily gainer — fixed (rightmost, below BTC) */}
      <StockMiniCard sym={gainer.sym} price={gainer.price} change={gainer.change} isTop selected={selected} onSelect={onSelect} />

      {/* 3 editable stock tiles */}
      {editable.map((sym, i) => editingIdx === i ? (
        <EditCell key={`edit-${i}`} initial={sym} onCommit={commit} onCancel={() => setEditing(null)} />
      ) : (
        <StockMiniCard key={`${sym}-${i}`} sym={sym} price={stocks[sym]?.price} change={stocks[sym]?.change}
          selected={selected} onSelect={onSelect} onLongPress={() => setEditing(i)} />
      ))}
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

      {/* edit hint */}
      <div className="hp-stock-hint">✎ לעריכת אריח — לחיצה ארוכה (מעל שנייה). ביטקוין והגיינר היומי קבועים.</div>

      {/* ── Soft gold separator ── */}
      <hr className="hp-divider" />

      {/* ── Robots section ── */}
      <div className="hp-section-title">🤖 סקנרים &amp; רובוטים</div>
      <div className="hp-robots">
        <RobotCard icon="🛰️" name="TGM"     desc="מעקב ודירוג ספקי לידים" tag="LIVE" tagColor="#22d3ee" onClick={() => navigate('tgm')} />
        <RobotCard icon="⚙️" name="W"       desc="קריפטו — BTC/ETH/SOL"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-w')} />
        <RobotCard icon="₿"  name="BIT"     desc="Bitcoin — 4H+1H"         tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-bit')} />
        <RobotCard icon="📐" name="S.M.C"   desc="Smart Money מוסדי"       tag="אנליזה" tagColor="#a78bfa" onClick={() => navigate('model-smc')} />
        <RobotCard icon="📊" name="FINVIZ"  desc="9 תבניות ריוורסל"        tag="סריקה" tagColor="#f59e0b" onClick={() => navigate('finviz')} />
        <RobotCard icon="📋" name="ETORO"   desc="קופי טריידינג"            tag="Demo"  tagColor="#94a3b8" onClick={() => navigate('etoro')} />
        <RobotCard icon="📐" name="GRID"    desc="גריד BTC — רמות קנייה"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-grid')} />
        <RobotCard icon="🗞️" name="NEWS AI" desc="חדשות מדורגות AI"         tag="אצור"  tagColor="#94a3b8" onClick={() => navigate('daily')} />
      </div>

    </div>
  );
}
