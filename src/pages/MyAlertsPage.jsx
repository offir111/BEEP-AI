/**
 * MyAlertsPage.jsx — duplicate of ChartsPage (opened from the user avatar).
 * Starting point — will diverge from the charts tab per upcoming notes.
 * Reuses ChartsPage.css for now.
 */
import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import AlertLine          from '../components/AlertLine';
import QuickAlert         from '../components/QuickAlert';
import IframeWithFallback from '../components/IframeWithFallback';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import './ChartsPage.css';
import './MyAlertsPage.css';

function toCtxSym(active) {
  if (!active || active.isCustom) return null;
  if (active.binance) return active.binance.replace('USDT', '');
  const map = { 'GC=F': 'GOLD', 'XAUUSD=X': 'GOLD', 'XAGUSD=X': 'SILVER', '^GSPC': 'S&P' };
  return map[active.priceApi] || active.priceApi;
}

const SYMBOLS = [
  { id:'BTCUSD',  label:'Bitcoin',   exchange:'BINANCE', binance:'BTCUSDT',  priceApi:'BTC'   },
  { id:'ETHUSD',  label:'Ethereum',  exchange:'BINANCE', binance:'ETHUSDT',  priceApi:'ETH'   },
  { id:'SOLUSD',  label:'Solana',    exchange:'BINANCE', binance:'SOLUSDT',  priceApi:'SOL'   },
  { id:'XAUUSD',  label:'Gold',      exchange:'OANDA',   binance:null,       priceApi:'GC=F'  },
  { id:'AAPL',    label:'Apple',     exchange:'NASDAQ',  binance:null,       priceApi:'AAPL'  },
  { id:'NVDA',    label:'NVIDIA',    exchange:'NASDAQ',  binance:null,       priceApi:'NVDA'  },
  { id:'TSLA',    label:'Tesla',     exchange:'NASDAQ',  binance:null,       priceApi:'TSLA'  },
  { id:'MSFT',    label:'Microsoft', exchange:'NASDAQ',  binance:null,       priceApi:'MSFT'  },
  { id:'AMZN',    label:'Amazon',    exchange:'NASDAQ',  binance:null,       priceApi:'AMZN'  },
  { id:'GOOGL',   label:'Google',    exchange:'NASDAQ',  binance:null,       priceApi:'GOOGL' },
  { id:'SPY',     label:'S&P 500',   exchange:'AMEX',    binance:null,       priceApi:'^GSPC' },
];

const INTERVALS = [
  {id:'1',label:'1m'},{id:'5',label:'5m'},{id:'15',label:'15m'},
  {id:'60',label:'1h'},{id:'240',label:'4h'},{id:'D',label:'1D'},{id:'W',label:'1W'},
];

/* Editable saved-symbol buttons — persisted per user */
const SYMS_KEY = 'beepai_myalerts_syms';
function loadSymbols() {
  try {
    const s = JSON.parse(localStorage.getItem(SYMS_KEY));
    if (Array.isArray(s) && s.length) return s;
  } catch {}
  return SYMBOLS;
}

const CRYPTOS = ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','DOT','AVAX','MATIC','LINK','LTC','TRX','SHIB','PEPE'];
function makeSymbolEntry(raw) {
  const sym = (raw || '').trim().toUpperCase();
  if (!sym) return null;
  if (CRYPTOS.includes(sym)) {
    return { id: sym + 'USD', label: sym, exchange: 'BINANCE', binance: sym + 'USDT', priceApi: sym, isCustom: true };
  }
  return { id: sym, label: sym, exchange: 'NASDAQ', binance: null, priceApi: sym, isCustom: true };
}

function buildTVUrl(sym, exchange, interval) {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${exchange}%3A${sym}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

function useSymbolSearch() {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const timerRef   = useRef(null);

  const search = useCallback((q) => {
    setQuery(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const r   = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const items = await r.json();
        setResults(Array.isArray(items) ? items : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const close = useCallback(() => { setOpen(false); setQuery(''); setResults([]); }, []);

  return { query, results, loading, open, search, close, setOpen };
}

export default function MyAlertsPage() {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const [active,    setActive]    = useState(SYMBOLS[0]);
  const [interval,  setInterval]  = useState('D');
  const [showAlert, setShowAlert] = useState(false);
  const [symbols,   setSymbols]   = useState(loadSymbols);
  const [editMode,  setEditMode]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editVal,   setEditVal]   = useState('');

  const persistSymbols = (next) => {
    setSymbols(next);
    try { localStorage.setItem(SYMS_KEY, JSON.stringify(next)); } catch {}
  };
  const removeSymbol = (id) => persistSymbols(symbols.filter(s => s.id !== id));

  const startRename = (s) => {
    const short = s.binance ? s.id.replace('USD','') : (s.priceApi || s.label);
    setEditingId(s.id);
    setEditVal(short.toUpperCase());
  };
  const commitRename = (id) => {
    const entry = makeSymbolEntry(editVal);
    setEditingId(null);
    setEditVal('');
    if (!entry) return;
    persistSymbols(symbols.map(x => x.id === id ? entry : x));
  };
  const containerRef = useRef(null);
  const searchWrapRef = useRef(null);
  const [containerH, setContainerH] = useState(480);

  const { query, results, loading, open, search, close, setOpen } = useSymbolSearch();

  const lqCtx   = useContext(LiveQuoteContext);
  const ctxSym  = useMemo(() => toCtxSym(active), [active]);
  const { price: ctxPrice, flash: ctxFlash } = useQuote(ctxSym);

  useEffect(() => {
    if (!lqCtx || !ctxSym) return;
    lqCtx.subscribe([ctxSym]);
    return () => lqCtx.unsubscribe([ctxSym]);
  }, [ctxSym, lqCtx]);

  const [localPrice, setLocalPrice] = useState(null);
  useEffect(() => {
    setLocalPrice(null);
    if (!active?.isCustom) return;
    let cancelled = false;
    const poll = async () => {
      try {
        let p = null;
        if (active.binance) {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${active.binance}`);
          const d = await r.json();
          p = parseFloat(d.price);
        } else {
          const r = await fetch(`/api/market?symbol=${encodeURIComponent(active.priceApi)}`);
          const d = await r.json();
          p = d.price ? parseFloat(d.price) : null;
        }
        if (!cancelled && p) setLocalPrice(p);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [active]);

  const livePrice = ctxSym ? (ctxPrice ?? null) : localPrice;

  const [chartRange, setChartRange] = useState(null);
  useEffect(() => {
    setChartRange(null);
    if (!active?.binance) return;
    const BINANCE_INTERVAL = { '1':'1m','5':'5m','15':'15m','60':'1h','240':'4h','D':'1d','W':'1w' };
    const bInterval = BINANCE_INTERVAL[interval] || '1d';
    fetch(`https://api.binance.com/api/v3/klines?symbol=${active.binance}&interval=${bInterval}&limit=200`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || !data.length) return;
        let hi = -Infinity, lo = Infinity;
        for (const k of data) { hi = Math.max(hi, parseFloat(k[2])); lo = Math.min(lo, parseFloat(k[3])); }
        setChartRange({ high: hi, low: lo });
      })
      .catch(() => {});
  }, [active, interval]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerH(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpen]);

  const selectSearchResult = (r) => {
    const parts   = (r.full_name || '').split(':');
    const exch    = parts.length === 2 ? parts[0] : (r.exchange || 'NASDAQ');
    const sym     = parts.length === 2 ? parts[1] : r.symbol;
    const custom  = {
      id:       sym,
      label:    r.description || sym,
      exchange: exch,
      binance:  null,
      priceApi: sym,
      isCustom: true,
    };
    if (editMode) {
      // In edit mode → add to the saved buttons (persist)
      if (!symbols.some(s => s.id === custom.id)) persistSymbols([...symbols, custom]);
    } else {
      setActive(custom);
    }
    close();
  };

  const activeShort = active.binance
    ? active.id.replace('USD','')
    : active.priceApi.replace('^','').replace('=F','').replace('=X','');

  const symAlerts = alerts.filter(a =>
    !a.triggered && a.symbol === activeShort.toUpperCase()
  );

  return (
    <div className="charts-wrap ma-page">

      {/* Header */}
      <div className="charts-hdr">
        <div className="charts-hdr-left">
          <h2 className="charts-title">
            📈 {active.label}
            {livePrice && (
              <span className={`charts-live-price${ctxFlash === 'up' ? ' lp-flash-up' : ctxFlash === 'down' ? ' lp-flash-down' : ''}`}>
                ${parseFloat(livePrice).toLocaleString()}
              </span>
            )}
          </h2>
          {symAlerts.length > 0 && (
            <span className="charts-alert-count">🔔 {symAlerts.length}</span>
          )}
        </div>
        <div className="charts-hdr-right">
          <div className="charts-intervals">
            {INTERVALS.map(iv => (
              <button key={iv.id}
                className={`charts-iv-btn ${interval===iv.id?'charts-iv-btn--on':''}`}
                onClick={()=>setInterval(iv.id)}>{iv.label}</button>
            ))}
          </div>
          <button className="charts-alert-btn" onClick={()=>setShowAlert(true)}>
            🔔 <span>התראה</span>
          </button>
        </div>
      </div>

      {/* ── Symbol search bar ── */}
      <div className="charts-search-wrap" ref={searchWrapRef}>
        <div className="charts-search-row">
          <span className="charts-search-icon">🔍</span>
          <input
            className="charts-search-input"
            type="text"
            value={query}
            onChange={e => search(e.target.value)}
            onFocus={() => query && setOpen(true)}
            placeholder="חפש מניה... NVDA, AAPL, RIOT, SPY"
            dir="ltr"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {loading && <span className="charts-search-spin">⌛</span>}
          {query && !loading && (
            <button className="charts-search-clear" onClick={close} aria-label="נקה חיפוש">✕</button>
          )}
        </div>

        {open && (
          <div className="charts-search-dropdown">
            {loading && <div className="charts-search-empty">🔍 מחפש...</div>}
            {!loading && results.length === 0 && (
              <div className="charts-search-empty">לא נמצאו מניות — נסה שם אחר</div>
            )}
            {results.map((r, i) => {
              const parts = (r.full_name || '').split(':');
              const exch  = parts.length === 2 ? parts[0] : (r.exchange || '');
              const sym   = parts.length === 2 ? parts[1] : r.symbol;
              return (
                <button key={i} className="charts-search-result" onClick={() => selectSearchResult(r)}>
                  <span className="csr-sym">{sym}</span>
                  <span className="csr-name">{r.description || '—'}</span>
                  <span className="csr-exch">{exch}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Symbol buttons (editable) */}
      <div className="charts-symbols">
        <button
          className={`ma-edit-toggle${editMode ? ' --active' : ''}`}
          onClick={() => setEditMode(m => !m)}>
          {editMode ? '✓ סיום' : '✏ עריכה'}
        </button>

        {active.isCustom && !editMode && (
          <button className="charts-sym-btn charts-sym-btn--on charts-sym-btn--custom">
            ✦ {active.id}
            <span className="charts-sym-exch">{active.exchange}</span>
          </button>
        )}

        {symbols.map(s => {
          const sShort = s.binance ? s.id.replace('USD','') : s.priceApi.replace('^','').replace('=F','').replace('=X','');
          const sAlerts = alerts.filter(a => !a.triggered && a.symbol === sShort.toUpperCase()).length;

          if (editMode && editingId === s.id) {
            return (
              <div key={s.id} className="ma-sym-wrap">
                <input
                  className="ma-sym-input"
                  value={editVal}
                  autoFocus
                  dir="ltr"
                  onChange={e => setEditVal(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') { setEditingId(null); setEditVal(''); } }}
                  onBlur={() => commitRename(s.id)}
                />
              </div>
            );
          }

          return (
            <div key={s.id} className="ma-sym-wrap">
              <button
                className={`charts-sym-btn ${active.id===s.id&&!active.isCustom?'charts-sym-btn--on':''}`}
                onClick={()=> editMode ? startRename(s) : setActive(s)}>
                {s.label}
                {sAlerts > 0 && <span className="charts-sym-badge">🔔</span>}
              </button>
              {editMode && (
                <button className="ma-sym-del" onClick={() => removeSymbol(s.id)} aria-label="הסר">✕</button>
              )}
            </div>
          );
        })}

        {editMode && (
          <span className="ma-edit-hint">חפש מניה למעלה כדי להוסיף ↑</span>
        )}
      </div>

      {/* Chart + alert lines overlay */}
      <div className="charts-tv-wrap" ref={containerRef}>
        <IframeWithFallback
          iframeKey={`${active.id}-${interval}`}
          src={buildTVUrl(active.id, active.exchange, interval)}
          title={`גרף ${active.label}`}
          className="charts-tv-iframe"
        />

        {livePrice && symAlerts.length > 0 && (
          <div className="charts-lines-overlay">
            {symAlerts.map(a => (
              <AlertLine
                key={a.id}
                alert={a}
                containerH={containerH}
                currentPrice={livePrice}
                chartRange={chartRange}
                onPriceChange={editAlert}
                onRemove={removeAlert}
              />
            ))}
          </div>
        )}

        <button className="charts-float-bell" onClick={()=>setShowAlert(true)}>
          🔔
          {symAlerts.length > 0 && <span className="charts-float-badge">{symAlerts.length}</span>}
          {livePrice && (
            <span className={`charts-float-price${ctxFlash === 'up' ? ' lp-flash-up' : ctxFlash === 'down' ? ' lp-flash-down' : ''}`}>
              ${parseFloat(livePrice).toLocaleString()}
            </span>
          )}
        </button>
      </div>

      {showAlert && (
        <QuickAlert
          symbol={active.binance ? active.id.replace('USD','') : active.priceApi.replace('^','').replace('=F','').replace('=X','')}
          currentPrice={livePrice}
          onClose={()=>setShowAlert(false)}
        />
      )}
    </div>
  );
}
