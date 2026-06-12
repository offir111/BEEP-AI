import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import AlertLine          from '../components/AlertLine';
import QuickAlert         from '../components/QuickAlert';
import IframeWithFallback from '../components/IframeWithFallback';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import './ChartsPage.css';

/* Map a ChartsPage SYMBOLS entry → LiveQuoteContext symbol key */
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

function buildTVUrl(sym, exchange, interval) {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${exchange}%3A${sym}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

// ── Symbol search (via server proxy → Yahoo Finance) ──────────
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

export default function ChartsPage() {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const [active,    setActive]    = useState(SYMBOLS[0]);
  const [interval,  setInterval]  = useState('D');
  const [showAlert, setShowAlert] = useState(false);
  const containerRef = useRef(null);
  const searchWrapRef = useRef(null);
  const [containerH, setContainerH] = useState(480);

  const { query, results, loading, open, search, close, setOpen } = useSymbolSearch();

  // ── Centralized live price via LiveQuoteContext ──────────────
  const lqCtx   = useContext(LiveQuoteContext);
  const ctxSym  = useMemo(() => toCtxSym(active), [active]);
  const { price: ctxPrice } = useQuote(ctxSym);

  useEffect(() => {
    if (!lqCtx || !ctxSym) return;
    lqCtx.subscribe([ctxSym]);
    return () => lqCtx.unsubscribe([ctxSym]);
  }, [ctxSym, lqCtx]);

  // For custom (search-result) symbols: local fetch fallback
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

  // Unified live price: context (WebSocket/polling) or local fallback
  const livePrice = ctxSym ? (ctxPrice ?? null) : localPrice;

  // Measure container height for alert lines
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerH(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpen]);

  // Select a search result — build a dynamic symbol entry
  const selectSearchResult = (r) => {
    // r.full_name = "NASDAQ:CIFR" or just symbol
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
    setActive(custom);
    close();
  };

  // Active non-triggered alerts for current symbol
  const activeShort = active.binance
    ? active.id.replace('USD','')
    : active.priceApi.replace('^','').replace('=F','').replace('=X','');

  const symAlerts = alerts.filter(a =>
    !a.triggered && a.symbol === activeShort.toUpperCase()
  );

  return (
    <div className="charts-wrap">

      {/* Header */}
      <div className="charts-hdr">
        <div className="charts-hdr-left">
          <h2 className="charts-title">
            📈 {active.label}
            {livePrice && <span className="charts-live-price">${parseFloat(livePrice).toLocaleString()}</span>}
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

      {/* Symbol buttons */}
      <div className="charts-symbols">
        {active.isCustom && (
          <button className="charts-sym-btn charts-sym-btn--on charts-sym-btn--custom">
            ✦ {active.id}
            <span className="charts-sym-exch">{active.exchange}</span>
          </button>
        )}
        {SYMBOLS.map(s => {
          const sShort = s.binance ? s.id.replace('USD','') : s.priceApi.replace('^','').replace('=F','').replace('=X','');
          const sAlerts = alerts.filter(a => !a.triggered && a.symbol === sShort.toUpperCase()).length;
          return (
            <button key={s.id}
              className={`charts-sym-btn ${active.id===s.id&&!active.isCustom?'charts-sym-btn--on':''}`}
              onClick={()=>setActive(s)}>
              {s.label}
              {sAlerts > 0 && <span className="charts-sym-badge">🔔</span>}
            </button>
          );
        })}
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
                onPriceChange={editAlert}
                onRemove={removeAlert}
              />
            ))}
          </div>
        )}

        <button className="charts-float-bell" onClick={()=>setShowAlert(true)}>
          🔔
          {symAlerts.length > 0 && <span className="charts-float-badge">{symAlerts.length}</span>}
          {livePrice && <span className="charts-float-price">${parseFloat(livePrice).toLocaleString()}</span>}
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
