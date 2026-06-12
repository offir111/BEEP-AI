import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import ScannerWidget  from '../components/ScannerWidget';
import MiniChartPanel from '../components/MiniChartPanel';
import './HomePage.css';

// ── Live BTC ticker (for market strip flash only) ──────────────
function useBTC() {
  const [btc, setBtc] = useState(null);
  const [btcError, setBtcError] = useState(false);
  const [flash, setFlash] = useState(null);
  const prevRef = useRef(null);

  const fetch_ = useCallback(() => {
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        const price  = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChangePercent);
        const high   = parseFloat(d.highPrice);
        const low    = parseFloat(d.lowPrice);
        if (prevRef.current !== null) {
          if (price > prevRef.current) setFlash('up');
          else if (price < prevRef.current) setFlash('down');
          setTimeout(() => setFlash(null), 600);
        }
        prevRef.current = price;
        setBtcError(false);
        setBtc({ price, change, high, low });
      })
      .catch(() => setBtcError(true));
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, 15000);
    return () => clearInterval(iv);
  }, [fetch_]);

  return { btc, btcError, flash };
}

// ── Small market pill ─────────────────────────────────────────
function MarketPill({ symbol, label, prefix = '$' }) {
  const [price,   setPrice]   = useState(null);
  const [change,  setChange]  = useState(null);
  const [failed,  setFailed]  = useState(false);
  const [retry,   setRetry]   = useState(0);

  useEffect(() => {
    setFailed(false);
    const timer = setTimeout(() => setFailed(true), 15000);
    fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        clearTimeout(timer);
        if (d.price) { setPrice(d.price); setChange(d.changePercent ?? 0); setFailed(false); }
        else setFailed(true);
      })
      .catch(() => { clearTimeout(timer); setFailed(true); });
    return () => clearTimeout(timer);
  }, [symbol, retry]);

  const up = (change || 0) >= 0;
  return (
    <div className="hp-pill" onClick={failed ? () => setRetry(r => r + 1) : undefined}
      style={failed ? { cursor: 'pointer' } : undefined} title={failed ? 'לחץ לרענון' : undefined}>
      <span className="hp-pill-label">{label}</span>
      {price
        ? <>
            <span className="hp-pill-price">{prefix}{price.toLocaleString('en', { maximumFractionDigits: price < 10 ? 2 : 0 })}</span>
            <span className="hp-pill-change" style={{ color: up ? '#4ade80' : '#f87171' }}>
              {up ? '▲' : '▼'}{Math.abs(change).toFixed(1)}%
            </span>
          </>
        : failed ? <span className="hp-pill-failed" title="לחץ לרענון">↺</span>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Fear & Greed mini ─────────────────────────────────────────
function FearGreedMini() {
  const [val, setVal] = useState(null);
  const [lbl, setLbl] = useState('');
  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setVal(parseInt(d?.data?.[0]?.value)); setLbl(d?.data?.[0]?.value_classification || ''); })
      .catch(() => {});
  }, []);
  const color = !val ? '#888' : val <= 25 ? '#ef4444' : val <= 45 ? '#f97316' : val <= 55 ? '#eab308' : val <= 75 ? '#84cc16' : '#22c55e';
  return (
    <div className="hp-pill">
      <span className="hp-pill-label">F&amp;G</span>
      {val
        ? <><span className="hp-pill-price" style={{ color }}>{val}</span><span className="hp-pill-change" style={{ color, fontSize: '0.62rem' }}>{lbl}</span></>
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
const DEFAULT_EDITABLE = ['S&P','SOL','ETH','GOLD','QQQ','AAPL'];
const LS_SYMBOL_KEY    = 'beepai_chart_sym';
const LS_LAST_KEY      = 'beepai_last_searched';
const LS_EDITABLE_KEY  = 'beepai_editable_slots';

const CRYPTO_SET = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','DOT','AVAX','MATIC','LINK','DOGE','LTC','ATOM','RIOT','HUT','MARA','CLSK','BSOL']);
const STOCK_API  = { 'S&P':'^GSPC','SP500':'^GSPC','GOLD':'XAUUSD=X','SILVER':'XAGUSD=X','OIL':'CL=F' };
function toApiSym(s) { return STOCK_API[s.toUpperCase()] || s; }

/* hook: fetch % change for a list of symbols, refresh every 30s */
function useChanges(symbols) {
  const [ch, setCh] = useState({});
  const key = useMemo(() => symbols.filter(Boolean).join(','), [symbols]);

  useEffect(() => {
    if (!key) return;
    const syms   = key.split(',').filter(Boolean);
    const crypto = syms.filter(s => CRYPTO_SET.has(s.toUpperCase()));
    const stocks = syms.filter(s => !CRYPTO_SET.has(s.toUpperCase()));

    const fetchAll = () => {
      if (crypto.length) {
        const pairs = JSON.stringify(crypto.map(s => s.toUpperCase() + 'USDT'));
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(pairs)}`)
          .then(r => r.json())
          .then(arr => {
            if (!Array.isArray(arr)) return;
            const u = {};
            arr.forEach(t => { u[t.symbol.replace('USDT','')] = parseFloat(t.priceChangePercent); });
            setCh(p => ({...p,...u}));
          }).catch(()=>{});
      }
      stocks.forEach(sym => {
        fetch(`/api/market?symbol=${encodeURIComponent(toApiSym(sym))}`)
          .then(r => r.json())
          .then(d => { if (d.changePercent != null) setCh(p => ({...p,[sym.toUpperCase()]:+d.changePercent})); })
          .catch(()=>{});
      });
    };

    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [key]);

  return ch;
}

/* small inline % badge */
function Pct({ sym, changes }) {
  const v = changes[sym?.toUpperCase()];
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className="hp-stock-pct" style={{ color: up ? '#4ade80' : '#f87171' }}>
      {up ? '+' : ''}{v.toFixed(1)}%
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
  const [editMode,   setEditMode]   = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const editInputRef = useRef(null);

  const lastSearched = localStorage.getItem(LS_LAST_KEY) || '';

  /* all 8 visible symbols for % fetch */
  const allSyms = useMemo(() => ['BTC', ...slots, lastSearched].filter(Boolean), [slots, lastSearched]);
  const changes = useChanges(allSyms);

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
  const exitEditMode = () => { setEditMode(false); setEditingIdx(null); setEditVal(''); };

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
      <div className="hp-stock-header">
        <span className="hp-stock-title">מניות מהירות</span>
        <button
          className={`hp-stock-edit-toggle${editMode ? ' --active' : ''}`}
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
        >
          {editMode ? '✓ סיום' : '✏ עריכה'}
        </button>
      </div>

      <div className="hp-stock-grid">
        {cells.map((cell, pos) => {
          /* ── BTC fixed ── */
          if (cell.type === 'fixed') return (
            <button key="btc"
              className={`hp-stock-btn hp-stock-btn--fixed${'BTC' === selected ? ' --active' : ''}`}
              onClick={() => onSelect('BTC')}
            >
              <span className="hp-stock-sym">BTC</span>
              <Pct sym="BTC" changes={changes} />
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
                {empty ? '—' : <><span className="hp-stock-sym">{sym}</span><Pct sym={sym} changes={changes} /></>}
              </button>
            );
          }

          /* ── Editable slot ── */
          const i   = cell.idx;
          const sym = slots[i];
          const isEditing = editMode && editingIdx === i;

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
              className={`hp-stock-btn${sym === selected ? ' --active' : ''}${editMode ? ' --edit-mode' : ''}`}
              onClick={() => editMode ? openEdit(i) : onSelect(sym)}
            >
              <span className="hp-stock-sym">{sym}</span>
              {!editMode && <Pct sym={sym} changes={changes} />}
              {editMode && <span className="hp-stock-pencil">✏</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function HomePage({ navigate }) {
  const { btc, btcError, flash } = useBTC();
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

      {/* ── Mini chart panel — symbol changes on button click ── */}
      <MiniChartPanel navigate={navigate} symbol={chartSymbol} />

      {/* ── Market strip ── */}
      <div className="hp-market-strip">
        <MarketPill symbol="^GSPC"    label="S&P 500" />
        <MarketPill symbol="XAUUSD=X" label="זהב" />
        <MarketPill symbol="ETH-USD"  label="ETH" />
        <MarketPill symbol="SOL-USD"  label="SOL" />
        <FearGreedMini />
        {/* גרפים button — opens full chart page */}
        <button className="hp-charts-pill" onClick={() => navigate('charts')}>
          <span className="hp-pill-label">גרפים</span>
          <span className="hp-charts-pill-icon">📈</span>
        </button>
      </div>

      {/* ── SOT Scanner Widget (replaces BTC hero) ── */}
      <ScannerWidget onSearch={handleSearch} />

      {/* ── 12 Stock buttons ── */}
      <StockButtons selected={chartSymbol} onSelect={handleSymbolSelect} />

      {/* ── 2 Feature cards ── */}
      <div className="hp-features">

        {/* Alert feature */}
        <button className="hp-feature-card hp-feature-alert" onClick={() => navigate('alerts')}>
          <div className="hp-feature-glow hp-feature-glow--alert" />
          <div className="hp-feature-icon">🔔</div>
          <div className="hp-feature-text">
            <div className="hp-feature-title">Push Alerts</div>
            <div className="hp-feature-sub">קבל התראה כשהמחיר מגיע ליעד — גם כשהאפליקציה סגורה</div>
          </div>
          {activeAlerts > 0
            ? <span className="hp-feature-badge hp-feature-badge--active">{activeAlerts} פעיל</span>
            : <span className="hp-feature-badge">+ הגדר</span>
          }
        </button>

        {/* SOT / BEEP AI feature */}
        <button className="hp-feature-card hp-feature-ai" onClick={() => navigate('sot')}>
          <div className="hp-feature-glow hp-feature-glow--ai" />
          <div className="hp-feature-icon">🤖</div>
          <div className="hp-feature-text">
            <div className="hp-feature-title">BEEP AI Scan</div>
            <div className="hp-feature-sub">סריקת AI מיידית — מגלה את המניות הכי חמות עכשיו</div>
          </div>
          <span className="hp-feature-badge hp-feature-badge--ai">הפעל</span>
        </button>

      </div>

      {/* ── Robots section ── */}
      <div className="hp-section-title">🤖 סקנרים &amp; רובוטים</div>
      <div className="hp-robots">
        <RobotCard icon="🤖" name="SOT"        desc="סריקת AI יומית"          tag="AI"    tagColor="#818cf8" onClick={() => navigate('sot')} />
        <RobotCard icon="⚙️" name="Model W"    desc="קריפטו — BTC/ETH/SOL"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-w')} />
        <RobotCard icon="₿"  name="Model BIT"  desc="Bitcoin — 4H+1H"         tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-bit')} />
        <RobotCard icon="📐" name="Model SMC"  desc="Smart Money מוסדי"       tag="אנליזה" tagColor="#a78bfa" onClick={() => navigate('model-smc')} />
        <RobotCard icon="📊" name="FINVIZ"     desc="9 תבניות ריוורסל"        tag="סריקה" tagColor="#f59e0b" onClick={() => navigate('finviz')} />
        <RobotCard icon="📋" name="eToro"      desc="קופי טריידינג"            tag="Demo"  tagColor="#94a3b8" onClick={() => navigate('etoro')} />
        <RobotCard icon="📐" name="Model Grid"  desc="גריד BTC — רמות קנייה"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-grid')} />
        <RobotCard icon="🗞️" name="Daily AI"   desc="חדשות מדורגות AI"         tag="אצור"  tagColor="#94a3b8" onClick={() => navigate('daily')} />
      </div>

      {/* ── Quick nav ── */}
      <div className="hp-section-title">⚡ גישה מהירה</div>
      <div className="hp-quick">
        <button className="hp-quick-btn" onClick={() => navigate('charts')}>📈<br/><small>גרפים</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('crypto')}>₿<br/><small>קריפטו</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('news')}>📰<br/><small>חדשות</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('daily')}>📅<br/><small>יומי</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('etoro')}>📋<br/><small>eToro</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('model-grid')}>📐<br/><small>Model Grid</small></button>
      </div>

    </div>
  );
}
