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

function buildTVUrl(tvSymbol) {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

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

function Pct({ v }) {
  if (v == null) return <span className="gn-c gn-c--na">—</span>;
  return <span className={`gn-c ${v >= 0 ? 'gn-up' : 'gn-dn'}`}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>;
}

export default function GainersPage() {
  const [mode,    setMode]    = useState('crypto');
  const [sortKey, setSortKey] = useState('p5m');   // default ranking = 5-minute change
  const [rows,    setRows]    = useState([]);
  const [stocks,  setStocks]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertSym, setAlertSym] = useState(null);
  const [alertCg,  setAlertCg]  = useState(null);
  const [showBox,  setShowBox]  = useState(false);
  const { alerts } = useAlerts();

  const prevRef = useRef({});

  /* ── Crypto — server proxy, poll 1s ── */
  useEffect(() => {
    if (mode !== 'crypto') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(apiUrl('/api/crypto-gainers'));
        const d = await r.json();
        if (cancelled || !Array.isArray(d.rows)) return;
        const prev = prevRef.current;
        setRows(d.rows.map(c => {
          const p0 = prev[c.sym];
          const dir = p0 == null ? '' : c.price > p0 ? 'up' : c.price < p0 ? 'down' : 'same';
          prev[c.sym] = c.price;
          return { sym: c.sym, id: c.id, price: c.price, mc: c.cap, dir,
                   p5m: c.p5m, p1h: c.p1h, p1d: c.p1d, p1w: c.p7d, p1m: c.p30d, p1y: c.p1y };
        }));
        setLoading(false);
      } catch { if (!cancelled) setLoading(false); }
    };
    poll();
    const iv = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [mode]);

  /* ── Stocks — TradingView screener (all timeframes), poll 20s ── */
  useEffect(() => {
    if (mode !== 'stocks') return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(apiUrl('/api/tv-screener?period=1d'));
        const d = await r.json();
        if (cancelled) return;
        setStocks((d.quotes || []).map(q => ({
          sym: q.symbol, price: q.price, mc: q.market_cap, dir: '',
          p5m: q.pct_5m, p1h: q.pct_1h, p1d: q.chg1d, p1w: q.pct_1w, p1m: q.pct_1m, p1y: q.pct_1y,
        })));
        setLoading(false);
      } catch { if (!cancelled) setLoading(false); }
    };
    load();
    const iv = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [mode]);

  const list = useMemo(() => {
    const src = mode === 'crypto' ? rows : stocks;
    return [...src]
      .sort((a, b) => (b[sortKey] ?? -1e9) - (a[sortKey] ?? -1e9))
      .slice(0, 50);
  }, [mode, rows, stocks, sortKey]);

  const switchMode = (m) => { setMode(m); setLoading(true); };
  const openDetail = (r) => { setAlertSym(r.sym); setAlertCg(r.id || null); setShowBox(false); };

  return (
    <div className="gn-wrap" dir="rtl">

      <div className="gn-toggle">
        <button className={`gn-tab${mode === 'crypto' ? ' gn-tab--on' : ''}`} onClick={() => switchMode('crypto')}>קריפטו</button>
        <button className={`gn-tab${mode === 'stocks' ? ' gn-tab--on' : ''}`} onClick={() => switchMode('stocks')}>מניות</button>
        <span className="gn-live"><span className="gn-live-dot" />LIVE</span>
      </div>

      {/* Scrollable table (header + rows share columns; scrolls left-right on mobile) */}
      <div className="gn-scroll">
      {/* Column header — timeframe columns are clickable to sort */}
      <div className="gn-head">
        <span>#</span>
        <span className="gn-h-sym">סימבול</span>
        <button className={`gn-h-sort${sortKey === 'p5m' ? ' gn-h-on' : ''}`} onClick={() => setSortKey('p5m')}>5M</button>
        <span className="gn-h-price">מחיר</span>
        <span>M.C</span>
        {RIGHT_COLS.map(c => (
          <button key={c.key} className={`gn-h-sort${sortKey === c.key ? ' gn-h-on' : ''}`} onClick={() => setSortKey(c.key)}>{c.label}</button>
        ))}
      </div>

      {loading && list.length === 0 && (
        <div className="gn-loading"><span className="gn-spinner" />טוען גיינרס…</div>
      )}

      <div className="gn-list">
        {list.map((r, i) => (
          <button key={r.sym} className="gn-row" onClick={() => openDetail(r)} title="פתח גרף">
            <span className="gn-rank">{i + 1}</span>
            <span className="gn-sym">{r.sym}</span>
            <Pct v={r.p5m} />
            <span key={r.price}
              className={`gn-price${r.dir === 'down' ? ' gn-flash-dn' : r.dir === 'up' ? ' gn-flash-up' : ''}`}
              dir="ltr">${fmtPrice(r.price)}</span>
            <span className="gn-mc">{fmtCap(r.mc)}</span>
            <Pct v={r.p1h} />
            <Pct v={r.p1d} />
            <Pct v={r.p1w} />
            <Pct v={r.p1m} />
            <Pct v={r.p1y} />
          </button>
        ))}
      </div>
      </div>{/* gn-scroll */}

      {alertSym && (
        <div className="gn-detail-overlay" onClick={() => setAlertSym(null)}>
          <div className="gn-detail-box" onClick={e => e.stopPropagation()}>
            <div className="gn-detail-iframe">
              <AlertChartPanel symbol={alertSym} isCrypto={mode === 'crypto'} interval="1d" />
            </div>
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
            {showBox && <QuickAlert contained symbol={alertSym} onClose={() => setShowBox(false)} />}
          </div>
        </div>
      )}
    </div>
  );
}
