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
import { createChart, CandlestickSeries, CrosshairMode } from 'lightweight-charts';
import './AlertChart.css';

// ── Binance symbols ───────────────────────────────────────────
const BINANCE = {
  BTC:  'BTCUSDT', ETH:  'ETHUSDT', SOL:  'SOLUSDT', BNB:  'BNBUSDT',
  XRP:  'XRPUSDT', DOGE: 'DOGEUSDT', ADA:  'ADAUSDT', AVAX: 'AVAXUSDT',
  BSOL: 'BSOLUSDT', KEEL: 'KEELBTC',
};

async function fetchCandles(symbol, isCrypto, cgId) {
  const s = symbol.toUpperCase();
  const pair = BINANCE[s] || (isCrypto ? `${s}USDT` : null);
  if (pair) {
    const r = await fetch(`/api/crypto-candles?symbol=${pair}${cgId ? `&cg=${encodeURIComponent(cgId)}` : ''}`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.candles) ? d.candles : [];
  }
  const yf = s === 'GOLD' ? 'GC=F' : s;
  const r  = await fetch(`/api/candles?symbol=${encodeURIComponent(yf)}`);
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d.candles) ? d.candles : [];
}

function makeChartOpts(w, h) {
  return {
    width: w,
    height: h,
    layout: {
      background: { color: '#0f0f1a' },
      textColor:  '#6b7280',
      fontFamily: 'inherit',
      attributionLogo: false,         // הסתרת לוגו TradingView (כמו באפליקציית האם)
    },
    grid: {
      vertLines: { color: '#12122a' },
      horzLines: { color: '#12122a' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#1e1e3a', textColor: '#9ca3af', autoScale: true },
    timeScale: {
      borderColor: '#1e1e3a', timeVisible: true, secondsVisible: false,
      rightOffset: 10, fixRightEdge: false, fixLeftEdge: false,
    },
    handleScale: {
      mouseWheel: true, pinch: true,
      axisPressedMouseMove: { time: true, price: false },
    },
    handleScroll: {
      mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false,
    },
  };
}

const PRICE_AXIS_PX = 75;

export default function AlertChart({ symbol, alerts = [], onAlertPriceChange, onAlertRemove, isCrypto, cgId }) {
  const containerRef     = useRef(null);   // chart canvas div (= chartDivRef)
  const chartRef         = useRef(null);
  const seriesRef        = useRef(null);
  const symRef           = useRef(symbol);
  const alertsRef        = useRef(alerts);
  const dragRef          = useRef(null);    // { id, startPrice, startChartY }
  const dragDeltaRef     = useRef(0);       // raw pixel delta (no chart API during move)
  const rafRef           = useRef(null);
  const priceChangeCbRef = useRef(onAlertPriceChange);
  const recomputeRef     = useRef(null);

  const [chartReady,     setChartReady]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);
  const [alertPositions, setAlertPositions] = useState({}); // { id: y }
  const [dragState,      setDragState]      = useState(null); // { id } | null
  const [dragDeltaY,     setDragDeltaY]     = useState(0);

  useEffect(() => { priceChangeCbRef.current = onAlertPriceChange; }, [onAlertPriceChange]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  // ── recompute alert Y positions (price → pixel) ──────────────
  const recompute = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    const pos = {};
    alertsRef.current
      .filter(a => !a.triggered)
      .forEach(a => {
        const y = series.priceToCoordinate(a.target);
        if (y != null) pos[a.id] = y;
      });
    setAlertPositions(pos);
  }, []);
  useEffect(() => { recomputeRef.current = recompute; }, [recompute]);

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
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    chartRef.current = chart;
    seriesRef.current = series;

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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── load candles when symbol changes ─────────────────────────
  useEffect(() => {
    symRef.current = symbol;
    if (!chartReady || !seriesRef.current) return;
    setLoading(true); setError(false);
    let cancelled = false;
    fetchCandles(symbol, isCrypto, cgId)
      .then(candles => {
        if (cancelled || symRef.current !== symbol || !seriesRef.current) return;
        if (!candles.length) { setError(true); return; }
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();
        setError(false);
        setTimeout(() => recomputeRef.current?.(), 30);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, chartReady]);

  // ── recompute positions whenever alerts change ───────────────
  useEffect(() => { if (chartReady) recompute(); }, [alerts, chartReady, recompute]);

  return (
    <div className="alert-chart-wrap">
      <div ref={containerRef} className="alert-chart-canvas" />

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
