import { useState, useEffect, useRef, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import QuickAlert from '../components/QuickAlert';
import AlertChartPanel from '../components/AlertChartPanel';
import { apiUrl } from '../utils/apiBase';
import './GainersPage.css';

const RIGHT_COLS = [
  { key: 'p1h', label: '1H' },
  { key: 'p1d', label: '1D' },
  { key: 'p1w', label: '1W' },
  { key: 'p1m', label: '1M' },
  { key: 'p1y', label: '1Y' },
];

const fmtPrice = (p) =>
  p == null ? '—' :
  p >= 1000 ? p.toLocaleString('en', { maximumFractionDigits: 0 }) :
  p >= 1    ? p.toFixed(2) :
              p.toFixed(5);

const fmtCap = (n) =>
  !n ? '—' :
  n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' :
  n >= 1e9  ? (n / 1e9).toFixed(1) + 'B' :
  n >= 1e6  ? (n / 1e6).toFixed(0) + 'M' : (n / 1e3).toFixed(0) + 'K';

// Renders a percentage cell; flashes green/red when the rounded value changes
function Pct({ v, prevV }) {
  if (v == null) return <span className="gn-c gn-c--na">—</span>;
  const rounded = Math.round(v * 10) / 10;
  const prevRounded = prevV != null ? Math.round(prevV * 10) / 10 : null;
  const changed = prevRounded != null && rounded !== prevRounded;
  const flashClass = changed ? (rounded > prevRounded ? ' gn-cell-up' : ' gn-cell-dn') : '';
  return (
    <span
      key={rounded}
      className={`gn-c ${v >= 0 ? 'gn-up' : 'gn-dn'}${flashClass}`}
    >
      {v >= 0 ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

// Shows "עודכן לפני X שניות"
function TsBar({ ts, stale }) {
  const [age, setAge] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const tick = () => setAge(Math.round((Date.now() - ts) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [ts]);
  if (!ts) return null;
  return (
    <div className="gn-ts-bar">
      <span className={`gn-ts-dot${stale ? ' gn-ts-dot--stale' : ''}`} />
      עודכן לפני {age}ש׳
      {stale && <span className="gn-ts-warn"> · ⚠ נתונים ישנים</span>}
    </div>
  );
}

export default function GainersPage() {
  const [mode,    setMode]    = useState('stocks');
  const [sortKey, setSortKey] = useState('p5m');
  const [rows,    setRows]    = useState([]);
  const [stocks,  setStocks]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [ts,      setTs]      = useState(null);
  const [stale,   setStale]   = useState(false);
  const [alertSym,   setAlertSym]   = useState(null);
  const [alertCg,    setAlertCg]    = useState(null);
  const [alertPrice, setAlertPrice] = useState(null);
  const [showBox,    setShowBox]    = useState(false);
  const [navList,    setNavList]    = useState(null);   // snapshot for chart arrows
  const [navIdx,     setNavIdx]     = useState(0);
  const { alerts } = useAlerts();

  // Track previous values for flash detection
  const prevCryptoRef = useRef({});
  const prevStocksRef = useRef({});

  /* ── Crypto — CoinGecko + Binance, poll 3s ── */
  useEffect(() => {
    if (mode !== 'crypto') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(apiUrl('/api/crypto-gainers'));
        const d = await r.json();
        if (cancelled || !Array.isArray(d.rows)) return;
        const prev = prevCryptoRef.current;
        setRows(d.rows.map(c => {
          const p0 = prev[c.sym];
          const dir = p0 == null ? '' : c.price > p0 ? 'up' : c.price < p0 ? 'down' : 'same';
          prev[c.sym] = c.price;
          return { sym: c.sym, id: c.id, price: c.price, mc: c.cap, dir,
                   p5m: c.p5m, p1h: c.p1h, p1d: c.p1d, p1w: c.p7d, p1m: c.p30d, p1y: c.p1y };
        }));
        setTs(d.ts || Date.now());
        setStale(false);
        setLoading(false);
      } catch { if (!cancelled) setLoading(false); }
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [mode]);

  /* ── Stocks — TradingView screener, poll 15s ── */
  useEffect(() => {
    if (mode !== 'stocks') return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(apiUrl(`/api/tv-screener?period=1d&_t=${Date.now()}`));
        const d = await r.json();
        if (cancelled) return;
        const prev = prevStocksRef.current;
        setStocks((d.quotes || []).map(q => {
          const key = q.symbol;
          const prevRow = prev[key] || {};
          const row = {
            sym: q.symbol, price: q.price, mc: q.market_cap, dir: '',
            p5m: q.pct_5m, p1h: q.pct_1h, p1d: q.chg1d,
            p1w: q.pct_1w, p1m: q.pct_1m, p1y: q.pct_1y,
            // previous values for flash detection
            _prev: { p5m: prevRow.p5m, p1h: prevRow.p1h, p1d: prevRow.p1d,
                     p1w: prevRow.p1w, p1m: prevRow.p1m, p1y: prevRow.p1y },
          };
          // price direction
          if (prevRow.price != null) {
            row.dir = q.price > prevRow.price ? 'up' : q.price < prevRow.price ? 'down' : 'same';
          }
          prev[key] = row;
          return row;
        }));
        setTs(d.ts || Date.now());
        setStale(!!d.stale);
        setLoading(false);
      } catch { if (!cancelled) setLoading(false); }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [mode]);

  const list = useMemo(() => {
    const src = mode === 'crypto' ? rows : stocks;
    return [...src]
      .sort((a, b) => (b[sortKey] ?? -1e9) - (a[sortKey] ?? -1e9))
      .slice(0, 50);
  }, [mode, rows, stocks, sortKey]);

  const switchMode = (m) => { setMode(m); setLoading(true); setTs(null); setStale(false); };
  const openDetail = (r) => {
    // snapshot the current gainers list so ◄► navigate within it (change% per row)
    const snap = list.map(x => ({ symbol: x.sym, pct: x.p1d ?? x.p5m ?? null, mcap: x.mc ?? null, isCrypto: mode === 'crypto', cgId: x.id || null }));
    const i = list.findIndex(x => x.sym === r.sym);
    setNavList(snap); setNavIdx(i >= 0 ? i : 0);
    setAlertSym(r.sym); setAlertCg(r.id || null); setAlertPrice(r.price ?? null); setShowBox(false);
  };

  return (
    <div className="gn-wrap" dir="rtl">

      <div className="gn-toggle">
        <button className={`gn-tab${mode === 'stocks' ? ' gn-tab--on' : ''}`} onClick={() => switchMode('stocks')}>מניות</button>
        <button className={`gn-tab${mode === 'crypto' ? ' gn-tab--on' : ''}`} onClick={() => switchMode('crypto')}>קריפטו</button>
        <span className="gn-live"><span className="gn-live-dot" />LIVE</span>
      </div>

      {/* filter note */}
      <div className="gn-filter-note">
        {mode === 'stocks'
          ? <>🇺🇸 מניות אמריקאיות · ווליום מעל 300K · מחיר מעל $2 · <b>TradingView Gainers</b> · מתרענן כל 8ש׳</>
          : <>₿ קריפטו · שווי שוק מעל $10M · <b>CoinGecko + Binance</b> · מתרענן כל 3ש׳</>}
      </div>

      {/* last-updated timestamp */}
      <TsBar ts={ts} stale={stale} />

      {/* Scrollable table */}
      <div className="gn-scroll">
        <div className="gn-head">
          <span>#</span>
          <span className="gn-h-sym">סימבול</span>
          <button className={`gn-h-sort${sortKey === 'p5m' ? ' gn-h-on' : ''}`} onClick={() => setSortKey('p5m')}>5M</button>
          <button className={`gn-h-sort${sortKey === 'price' ? ' gn-h-on' : ''}`} onClick={() => setSortKey('price')}>מחיר</button>
          <button className={`gn-h-sort${sortKey === 'mc'    ? ' gn-h-on' : ''}`} onClick={() => setSortKey('mc')}>M.C</button>
          {RIGHT_COLS.map(c => (
            <button key={c.key} className={`gn-h-sort${sortKey === c.key ? ' gn-h-on' : ''}`} onClick={() => setSortKey(c.key)}>{c.label}</button>
          ))}
        </div>

        {loading && list.length === 0 && (
          <div className="gn-loading"><span className="gn-spinner" />טוען גיינרס…</div>
        )}

        <div className="gn-list">
          {list.map((r, i) => {
            const prev = r._prev || {};
            return (
              <button key={r.sym} className="gn-row" onClick={() => openDetail(r)} title="פתח גרף">
                <span className="gn-rank">{i + 1}</span>
                <span className="gn-sym">{r.sym}</span>
                <Pct v={r.p5m} prevV={prev.p5m} />
                <span
                  key={r.price}
                  className={`gn-price${r.dir === 'down' ? ' gn-flash-dn' : r.dir === 'up' ? ' gn-flash-up' : ''}`}
                  dir="ltr"
                >${fmtPrice(r.price)}</span>
                <span className="gn-mc">{fmtCap(r.mc)}</span>
                <Pct v={r.p1h} prevV={prev.p1h} />
                <Pct v={r.p1d} prevV={prev.p1d} />
                <Pct v={r.p1w} prevV={prev.p1w} />
                <Pct v={r.p1m} prevV={prev.p1m} />
                <Pct v={r.p1y} prevV={prev.p1y} />
              </button>
            );
          })}
        </div>
      </div>

      {alertSym && (
        <div className="gn-detail-overlay" onClick={() => setAlertSym(null)}>
          <div className="gn-detail-box" onClick={e => e.stopPropagation()}>
            {!showBox && (
              <div className="gn-detail-iframe">
                <AlertChartPanel symbol={alertSym} isCrypto={mode === 'crypto'} defaultTf="1D"
                  navList={navList} navStartIndex={navIdx} navPctLabel="שינוי יומי" />
              </div>
            )}
            <button className="gn-detail-x" onClick={() => setAlertSym(null)} aria-label="סגור גרף">✕</button>
            {!showBox && (
              <button className="gn-detail-bell" onClick={() => setShowBox(true)}>
                🔔 <span>התראה</span>
                {alerts.filter(a => !a.triggered && a.symbol === alertSym.toUpperCase()).length > 0 && (
                  <span className="gn-detail-bell-badge">
                    {alerts.filter(a => !a.triggered && a.symbol === alertSym.toUpperCase()).length}
                  </span>
                )}
              </button>
            )}
            {showBox && <QuickAlert contained symbol={alertSym} currentPrice={alertPrice} onClose={() => setShowBox(false)} />}
          </div>
        </div>
      )}
    </div>
  );
}
