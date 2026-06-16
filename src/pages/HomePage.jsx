import { useState, useEffect, useContext, useRef } from 'react';
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

// ── Stock buttons ──────────────────────────────────────────────
// Layout (4 cols × 2 rows):
//   [edit0] [edit1] [edit2] [BTC-fixed]
//   [edit3] [edit4] [edit5] [last-searched]
// ──────────────────────────────────────────────────────────────
// ברירת מחדל לכפתורי המניות (RTL: BTC קבוע מימין). edit0..edit5:
// שורה 1: ETH · SOL · SPCX | שורה 2: GOLD · QQQ · S&P
const DEFAULT_EDITABLE = ['ETH','SOL','SPCX','GOLD','QQQ','S&P'];
const LS_SYMBOL_KEY    = 'beepai_chart_sym';
const LS_LAST_KEY      = 'beepai_last_searched';
const LS_EDITABLE_KEY  = 'beepai_editable_slots';

/* small inline % badge */
function Pct({ sym }) {
  const ctx = useContext(LiveQuoteContext);
  const { change, flash } = useQuote(sym);
  useEffect(() => {
    if (!ctx || !sym) return;
    ctx.subscribe([sym]);
    return () => ctx.unsubscribe([sym]);
  }, [sym, ctx]);
  if (change == null) return null;
  const up = change >= 0;
  return (
    <span className={`hp-stock-pct${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}
      style={{ color: up ? '#4ade80' : '#f87171' }}>
      {up ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

function loadEditable() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_EDITABLE_KEY));
    if (Array.isArray(s) && s.length === 6) return s;
  } catch {}
  return [...DEFAULT_EDITABLE];
}

function StockButtons({ selected, onSelect }) {
  const [slots,      setSlots]      = useState(loadEditable);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const editInputRef = useRef(null);
  const pressTimer    = useRef(null);
  const longPressed   = useRef(false);

  const lastSearched = localStorage.getItem(LS_LAST_KEY) || '';

  useEffect(() => {
    if (editingIdx !== null) setTimeout(() => editInputRef.current?.focus(), 60);
  }, [editingIdx]);

  const saveSlots = (next) => { setSlots(next); localStorage.setItem(LS_EDITABLE_KEY, JSON.stringify(next)); };
  const openEdit  = (i)    => { setEditingIdx(i); setEditVal(slots[i]); };
  const commitEdit = () => {
    const sym = editVal.trim().toUpperCase();
    if (sym && editingIdx !== null) { const n=[...slots]; n[editingIdx]=sym; saveSlots(n); }
    setEditingIdx(null); setEditVal('');
  };
  const startPress = (i) => {
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longPressed.current = true; openEdit(i); }, 500);
  };
  const endPress = () => clearTimeout(pressTimer.current);

  // RTL grid — first = visual right
  // Row1: [BTC] [edit0] [edit1] [edit2]
  // Row2: [last][edit3] [edit4] [edit5]
  const cells = [
    { type:'fixed', sym:'BTC' },
    { type:'edit', idx:0 },
    { type:'edit', idx:1 },
    { type:'edit', idx:2 },
    { type:'last' },
    { type:'edit', idx:3 },
    { type:'edit', idx:4 },
    { type:'edit', idx:5 },
  ];

  return (
    <div className="hp-stock-section">
      <div className="hp-stock-grid">
        {cells.map((cell, pos) => {
          /* ── BTC fixed ── */
          if (cell.type === 'fixed') return (
            <button key="btc"
              className={`hp-stock-btn hp-stock-btn--fixed${'BTC' === selected ? ' --active' : ''}`}
              onClick={() => onSelect('BTC')}
            >
              <span className="hp-stock-sym">BTC</span>
              <Pct sym="BTC" />
            </button>
          );

          /* ── Last searched ── */
          if (cell.type === 'last') {
            const sym   = lastSearched || '';
            const empty = !sym;
            return (
              <button key="last"
                className={`hp-stock-btn hp-stock-btn--last${!empty && sym===selected ? ' --active' : ''}${empty ? ' --empty' : ''}`}
                onClick={() => !empty && onSelect(sym)}
                disabled={empty}
                title="מניה אחרונה שחיפשת"
              >
                {empty ? '—' : <><span className="hp-stock-sym">{sym}</span><Pct sym={sym} /></>}
              </button>
            );
          }

          /* ── Editable slot ── */
          const i   = cell.idx;
          const sym = slots[i];
          const isEditing = editingIdx === i;

          if (isEditing) return (
            <div key={i} className="hp-stock-edit-wrap">
              <input
                ref={editInputRef}
                className="hp-stock-edit-input"
                value={editVal}
                onChange={e => setEditVal(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingIdx(null); }}
                maxLength={8}
                placeholder={sym}
              />
              <button className="hp-stock-edit-ok" onClick={commitEdit}>✓</button>
            </div>
          );

          return (
            <button key={i}
              className={`hp-stock-btn${sym === selected ? ' --active' : ''}`}
              onPointerDown={() => startPress(i)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onSelect(sym); }}
            >
              <span className="hp-stock-sym">{sym}</span>
              <Pct sym={sym} />
            </button>
          );
        })}
      </div>
      <div className="hp-stock-hint">לעריכה — לחיצה רצופה על כפתור</div>
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

      {/* ── 12 Stock buttons ── */}
      <StockButtons selected={chartSymbol} onSelect={handleSymbolSelect} />

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
