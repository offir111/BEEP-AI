/**
 * AlertChart.jsx — Lightweight Charts v5 with draggable alert lines.
 *
 * שכפול מדויק של מנגנון הקווים הנגררים מאפליקציית האם (BEEP BEEP / PriceChart.jsx):
 *  • הקווים והתוויות הם שכבת HTML מעל הקנבס (לא createPriceLine).
 *  • הגרירה היא "פיקסלים טהורים" — בזמן הגרירה אין שום קריאה ל-API של הגרף;
 *    הקו מצויר ב-(baseY + dragDeltaY). ההמרה למחיר נעשית פעם אחת בלבד, בשחרור.
 *  • Pointer events (עכבר + מגע) עם setPointerCapture + requestAnimationFrame.
 * זהו בדיוק הקוד שעובד באפליקציית האם — כדי שלא "נסתבך" שוב.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, CrosshairMode, ColorType } from 'lightweight-charts';
import { apiUrl } from '../utils/apiBase';
import './AlertChart.css';

// צבעי רמזור לחום-סקטור (ירוק חם / כתום בינוני / אדום קר)
const SECTOR_TIER_COLOR = { green: '#4ade80', amber: '#EF9F27', red: '#f87171' };

// שווי-שוק מקוצר לחלונית המידע ($10.2B / $742M)
function fmtMcapShort(m) {
  if (!Number.isFinite(m) || m <= 0) return '—';
  if (m >= 1e12) return `$${(m / 1e12).toFixed(2)}T`;
  if (m >= 1e9)  return `$${(m / 1e9).toFixed(2)}B`;
  if (m >= 1e6)  return `$${(m / 1e6).toFixed(0)}M`;
  return `$${(m / 1e3).toFixed(0)}K`;
}

// ── Binance symbols ───────────────────────────────────────────
const BINANCE = {
  BTC:  'BTCUSDT', ETH:  'ETHUSDT', SOL:  'SOLUSDT', BNB:  'BNBUSDT',
  XRP:  'XRPUSDT', DOGE: 'DOGEUSDT', ADA:  'ADAUSDT', AVAX: 'AVAXUSDT',
  BSOL: 'BSOLUSDT', KEEL: 'KEELBTC',
};

async function fetchCandles(symbol, isCrypto, cgId, interval = '1d', limit = 200) {
  const s = symbol.toUpperCase();
  const pair = BINANCE[s] || (isCrypto ? `${s}USDT` : null);
  if (pair) {
    const r = await fetch(apiUrl(`/api/crypto-candles?symbol=${pair}&interval=${interval}&limit=${limit}${cgId ? `&cg=${encodeURIComponent(cgId)}` : ''}`));
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.candles) ? d.candles : [];
  }
  const yf = s === 'GOLD' ? 'GC=F' : s;
  const r  = await fetch(apiUrl(`/api/candles?symbol=${encodeURIComponent(yf)}&interval=${interval}`));
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d.candles) ? d.candles : [];
}

// זהה לאפליקציית האם (BEEP BEEP / PriceChart.jsx) — רקע שחור, ערכת זהב, לוגו מוסתר.
function makeChartOpts(w, h) {
  return {
    width: w,
    height: h,
    layout: {
      background: { type: ColorType.Solid, color: '#050505' },
      textColor:  '#c8a84b',
      fontSize:   11,
      fontFamily: 'Rubik, sans-serif',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: 'rgba(212,175,55,0.06)' },
      horzLines: { color: 'rgba(212,175,55,0.08)' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor:  'rgba(212,175,55,0.30)',
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor:    'rgba(212,175,55,0.30)',
      timeVisible:    true,
      secondsVisible: false,
      rightOffset:    1,
    },
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true },
    handleScale:  { mouseWheel: true,  pinch: true },
  };
}

const PRICE_AXIS_PX = 75;

export default function AlertChart({ symbol, alerts = [], onAlertPriceChange, onAlertRemove, isCrypto, cgId, interval = '1d', limit = 200, changePct = null, marketCap = null, newsEnabled = false, sector = null }) {
  const containerRef     = useRef(null);   // chart canvas div (= chartDivRef)
  const chartRef         = useRef(null);
  const seriesRef        = useRef(null);
  const volSeriesRef     = useRef(null);
  const symRef           = useRef(symbol);
  const alertsRef        = useRef(alerts);
  const dragRef          = useRef(null);    // { id, startPrice, startChartY }
  const dragDeltaRef     = useRef(0);       // raw pixel delta (no chart API during move)
  const rafRef           = useRef(null);
  const priceChangeCbRef = useRef(onAlertPriceChange);
  const recomputeRef     = useRef(null);
  const alertPositionsRef = useRef({});   // עותק עדכני לזיהוי שינוי בהצמדה הרציפה

  const [chartReady,     setChartReady]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);
  const [news,           setNews]           = useState([]);
  const [newsOpen,       setNewsOpen]       = useState(false);
  const [newsLive,       setNewsLive]       = useState(false);
  const [sectorHeat,     setSectorHeat]     = useState(null);   // { sectors:{name:{score,tier}} }
  const [lastPrice,      setLastPrice]      = useState(null);
  const [alertPositions, setAlertPositions] = useState({}); // { id: y }
  const [dragState,      setDragState]      = useState(null); // { id } | null
  const [dragDeltaY,     setDragDeltaY]     = useState(0);

  useEffect(() => { priceChangeCbRef.current = onAlertPriceChange; }, [onAlertPriceChange]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  // ── recompute alert Y positions (price → pixel), עם זיהוי שינוי ──
  // מעדכן state רק כשמשהו זז ביותר מ-0.5px — כך אפשר להריץ בכל פריים בלי הצפה.
  const recompute = useCallback(() => {
    const series = seriesRef.current;
    if (!series || dragRef.current) return; // בזמן גרירה — הפיקסלים מונעים מהדלתא, לא מ-priceToCoordinate
    const pos = {};
    alertsRef.current
      .filter(a => !a.triggered)
      .forEach(a => {
        const y = series.priceToCoordinate(a.target);
        if (y != null) pos[a.id] = y;
      });
    const prev = alertPositionsRef.current;
    const pk = Object.keys(prev), nk = Object.keys(pos);
    let changed = pk.length !== nk.length;
    if (!changed) {
      for (const k of nk) { if (Math.abs((prev[k] ?? -1e9) - pos[k]) > 0.5) { changed = true; break; } }
    }
    if (changed) { alertPositionsRef.current = pos; setAlertPositions(pos); }
  }, []);
  useEffect(() => { recomputeRef.current = recompute; }, [recompute]);

  // ── הצמדה רציפה לפיקסלים בכל פריים — כך הקווים עוקבים אחרי זום/autoscale ──
  // (זהו המקבילה האוניברסלית ל-recompute-per-tick שיש באפליקציית האם).
  useEffect(() => {
    if (!chartReady) return;
    let raf;
    const loop = () => { recomputeRef.current?.(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chartReady]);

  // ── coordinate helpers ───────────────────────────────────────
  const clientYToChartY = useCallback((clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clientY - rect.top;
  }, []);
  const chartYToPrice = useCallback((chartY) => {
    if (!seriesRef.current) return null;
    return seriesRef.current.coordinateToPrice(chartY);
  }, []);

  // ── drag handlers (פיקסלים טהורים; המרה למחיר רק בשחרור) ──────
  const handlePointerDown = useCallback((a, e) => {
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const startChartY = clientYToChartY(e.clientY) ?? 0;
    dragRef.current = { id: a.id, startPrice: a.target, startChartY };
    dragDeltaRef.current = 0;
    setDragDeltaY(0);
    setDragState({ id: a.id });
  }, [clientYToChartY]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const currentChartY = clientYToChartY(e.clientY);
    if (currentChartY == null) return;
    const delta = currentChartY - dragRef.current.startChartY;
    dragDeltaRef.current = delta;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setDragDeltaY(dragDeltaRef.current);
    });
  }, [clientYToChartY]);

  const handlePointerUp = useCallback((e) => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const d = dragRef.current;
    if (!d) return;
    const finalChartY = clientYToChartY(e.clientY);
    if (finalChartY != null) {
      const raw = chartYToPrice(finalChartY);
      if (raw != null && raw > 0) {
        const np = Math.round(raw * 100) / 100;
        if (np !== d.startPrice) priceChangeCbRef.current?.(d.id, np);
      }
    }
    dragRef.current = null; dragDeltaRef.current = 0;
    setDragState(null); setDragDeltaY(0);
    setTimeout(() => recomputeRef.current?.(), 30);
  }, [clientYToChartY, chartYToPrice]);

  const handlePointerCancel = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    dragRef.current = null; dragDeltaRef.current = 0;
    setDragState(null); setDragDeltaY(0);
  }, []);

  // ── create chart once (mount) ────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart  = createChart(el, makeChartOpts(el.clientWidth, el.clientHeight));
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#4ade80', downColor: '#f87171', borderVisible: false,
      borderUpColor: '#4ade80', borderDownColor: '#f87171',
      wickUpColor: '#4ade80', wickDownColor: '#f87171',
    });
    // היסטוגרמת ווליום בתחתית (כמו במקור)
    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(212,175,55,0.25)', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    seriesRef.current = series;
    volSeriesRef.current = volSeries;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      recomputeRef.current?.();
    });
    ro.observe(el);

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => recomputeRef.current?.());
    chart.subscribeCrosshairMove(() => recomputeRef.current?.());

    // מניעת זום אנכי על ציר המחיר בגלגלת
    const onWheel = (e) => {
      if (e.offsetX > el.clientWidth - PRICE_AXIS_PX) { e.stopPropagation(); e.preventDefault(); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    setChartReady(true);

    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
      setChartReady(false);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── load candles when symbol changes ─────────────────────────
  useEffect(() => {
    symRef.current = symbol;
    if (!chartReady || !seriesRef.current) return;
    setLoading(true); setError(false);
    let cancelled = false;
    fetchCandles(symbol, isCrypto, cgId, interval, limit)
      .then(candles => {
        if (cancelled || symRef.current !== symbol || !seriesRef.current) return;
        if (!candles.length) { setError(true); return; }
        const clean = candles.map(({ volume, ...c }) => c);
        const volumes = candles.map(d => ({
          time: d.time, value: d.volume ?? 0,
          color: d.close >= d.open ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)',
        }));
        seriesRef.current.setData(clean);
        volSeriesRef.current?.setData(volumes);
        chartRef.current?.timeScale().fitContent();
        const last = candles[candles.length - 1];
        if (last) setLastPrice(last.close);
        setError(false);
        setTimeout(() => recomputeRef.current?.(), 30);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, chartReady, interval, limit]);

  // ── recompute positions whenever alerts change ───────────────
  useEffect(() => { if (chartReady) recompute(); }, [alerts, chartReady, recompute]);

  // ── stock news (Yahoo) — only when enabled by the wrapper ─────
  useEffect(() => {
    setNewsOpen(false); setNews([]); setNewsLive(false);
    if (!newsEnabled || !symbol) return;
    let cancelled = false;
    fetch(apiUrl(`/api/stock-news?symbol=${encodeURIComponent(symbol)}&limit=10`))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (cancelled || !d) return; setNews(Array.isArray(d.news) ? d.news : []); setNewsLive(!!d.live); })
      .catch(() => { /* keep empty → no news box */ });
    return () => { cancelled = true; };
  }, [symbol, newsEnabled]);

  // ── sector heat map (0–100, live from Finviz) — fetched once when enabled ─────
  useEffect(() => {
    if (!newsEnabled || !sector) return;
    let cancelled = false;
    fetch(apiUrl('/api/sector-heat'))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && d.sectors) setSectorHeat(d); })
      .catch(() => { /* keep null → no sector row */ });
    return () => { cancelled = true; };
  }, [newsEnabled, sector]);

  return (
    <div className="alert-chart-wrap">
      <div ref={containerRef} className="alert-chart-canvas" />

      {/* ── חלונית מחיר — צמודה לפינה שמאל-עליון של הגרף ── */}
      {lastPrice != null && (
        <div className="pc-price-label" dir="ltr">
          <span className="pc-price-sym">{symbol}</span>
          <span className="pc-price-val">${Number(lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {Number.isFinite(marketCap) && (
            <span className="pc-price-mc">M.C {fmtMcapShort(marketCap)}</span>
          )}
          {Number.isFinite(changePct) && (
            <span className={`pc-price-chg ${changePct >= 0 ? 'pc-up' : 'pc-dn'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
            </span>
          )}
          {sector && sectorHeat?.sectors?.[sector] && (
            <span className="pc-sector" title={`חום סקטור (0–100, חי): ${sector}`}>
              <span className="pc-sector-dot" style={{ background: SECTOR_TIER_COLOR[sectorHeat.sectors[sector].tier] }} />
              <span className="pc-sector-name">{sector}</span>
              <span className="pc-sector-score" style={{ color: SECTOR_TIER_COLOR[sectorHeat.sectors[sector].tier] }}>
                {sectorHeat.sectors[sector].score}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── חדשות — במרכז-עליון של הגרף, מתחת לחיצים ── */}
      {newsEnabled && news.length > 0 && (
        <div className={`pc-news${newsOpen ? ' pc-news--open' : ''}`} dir="ltr">
          <button className="pc-news-head" onClick={() => setNewsOpen(o => !o)} title="חדשות מ-Yahoo Finance">
            <span className={`pc-news-badge ${newsLive ? 'pc-news-badge--live' : 'pc-news-badge--mock'}`}>{newsLive ? 'LIVE' : 'MOCK'}</span>
            <span className="pc-news-ic">📰</span>
            <span className="pc-news-title">{news[0].title}</span>
            <span className="pc-news-caret">{newsOpen ? '▲' : '▾'}</span>
          </button>
          {newsOpen && (
            <div className="pc-news-list">
              {news.map((n, i) => (
                <a key={i} className="pc-news-item" href={n.url} target="_blank" rel="noreferrer">
                  <span className="pc-news-item-title">{n.title}</span>
                  {n.publisher && <span className="pc-news-pub">{n.publisher}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── שכבת קווי ההתראות — לוכדת את אירועי הגרירה על כל שטח הגרף ── */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: dragState ? 'all' : 'none', zIndex: 10 }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {alerts.filter(a => !a.triggered).map(a => {
          const isDrag = dragState?.id === a.id;
          const baseY  = alertPositions[a.id];
          if (baseY == null) return null;
          const y = isDrag ? baseY + dragDeltaY : baseY;

          const disp = isDrag
            ? (() => {
                try {
                  const p = seriesRef.current?.coordinateToPrice(y);
                  return (p != null && p > 0) ? Math.round(p * 100) / 100 : a.target;
                } catch { return a.target; }
              })()
            : a.target;

          const isLoss    = a.direction === 'below';
          const lineColor = isLoss ? 'rgba(248,113,113,0.85)' : 'rgba(212,175,55,0.9)';
          const tagBg     = isLoss ? '#3d0c0c' : '#2a1d00';
          const tagBorder = isLoss ? '#f87171' : '#D4AF37';

          return (
            <div
              key={a.id}
              style={{
                position: 'absolute', top: y, left: 0, right: 0,
                transform: 'translateY(-50%)', pointerEvents: 'all',
                cursor: 'ns-resize', userSelect: 'none', touchAction: 'none',
                zIndex: isDrag ? 20 : 10,
              }}
              onPointerDown={e => handlePointerDown(a, e)}
            >
              <div style={{ width: '100%', height: 0, borderTop: `1px dashed ${lineColor}` }} />
              <div style={{
                position: 'absolute', left: '40%', top: '50%',
                transform: 'translate(-50%, -50%)',
                background: tagBg, border: `1px solid ${tagBorder}`,
                borderRadius: 4, padding: '2px 5px',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '0.72rem' }}>{isLoss ? '🔴' : '🟡'}</span>
                <span dir="ltr" style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                  ${disp.toFixed(2)}
                </span>
                <span style={{ color: '#888', fontSize: '0.7rem' }}>⠿</span>
                {onAlertRemove && (
                  <button
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 2px', fontSize: '0.65rem', lineHeight: 1 }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onAlertRemove(a.id); }}
                  >✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && !error && (
        <div className="alert-chart-overlay">
          <div className="alert-chart-spinner" />
          <span>{symbol}</span>
        </div>
      )}
      {error && (
        <div className="alert-chart-overlay">
          <span className="alert-chart-err">⚠ לא ניתן לטעון נתוני {symbol}</span>
        </div>
      )}
    </div>
  );
}
