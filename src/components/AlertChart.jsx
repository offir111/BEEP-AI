/**
 * AlertChart.jsx — Lightweight Charts with draggable alert price lines.
 *
 * Fixes:
 *  1. Right-edge "wall": rightOffset:10, fixRightEdge:false
 *  2. Wheel on price axis: intercepted — price scale zoom disabled
 *  3. Draggable lines: mousedown near line → drag → mouseup saves new price
 */
import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, CrosshairMode, LineStyle } from 'lightweight-charts';
import './AlertChart.css';

// ── Binance symbols ───────────────────────────────────────────
const BINANCE = {
  BTC:  'BTCUSDT', ETH:  'ETHUSDT', SOL:  'SOLUSDT', BNB:  'BNBUSDT',
  XRP:  'XRPUSDT', DOGE: 'DOGEUSDT', ADA:  'ADAUSDT', AVAX: 'AVAXUSDT',
  BSOL: 'BSOLUSDT', KEEL: 'KEELBTC',
};

async function fetchCandles(symbol) {
  const s = symbol.toUpperCase();
  if (BINANCE[s]) {
    const r = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${BINANCE[s]}&interval=1d&limit=200`
    );
    if (!r.ok) return [];
    const raw = await r.json();
    return raw.map(k => ({
      time:  Math.floor(k[0] / 1000),
      open:  parseFloat(k[1]),
      high:  parseFloat(k[2]),
      low:   parseFloat(k[3]),
      close: parseFloat(k[4]),
    }));
  }
  const yf = s === 'GOLD' ? 'GC=F' : s;
  const r  = await fetch(`/api/candles?symbol=${encodeURIComponent(yf)}`);
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d.candles) ? d.candles : [];
}

function makeChartOpts(w, h) {
  return {
    width:  w,
    height: h,
    layout: {
      background: { color: '#0f0f1a' },
      textColor:  '#6b7280',
      fontFamily: 'inherit',
    },
    grid: {
      vertLines: { color: '#12122a' },
      horzLines: { color: '#12122a' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: '#1e1e3a',
      textColor:   '#9ca3af',
      autoScale:   true,
    },
    timeScale: {
      borderColor:    '#1e1e3a',
      timeVisible:    true,
      secondsVisible: false,
      rightOffset:    10,      // fix 1: buffer after last bar
      fixRightEdge:   false,   // fix 1: don't lock right edge
      fixLeftEdge:    false,
    },
    handleScale: {
      mouseWheel:           true,
      pinch:                true,
      axisPressedMouseMove: { time: true, price: false }, // disable price-axis drag-scale
    },
    handleScroll: {
      mouseWheel:       true,
      pressedMouseMove: true,
      horzTouchDrag:    true,
      vertTouchDrag:    false,
    },
  };
}

// Pixels within which a cursor is considered "on" a price line
const HIT_PX = 7;
// Estimated width of the right price scale in px
const PRICE_AXIS_PX = 75;

export default function AlertChart({ symbol, alerts = [], onAlertPriceChange }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const linesRef     = useRef([]);        // { id, line, target }[]
  const symRef       = useRef(symbol);
  const draggingRef  = useRef(null);      // { id, line, currentPrice }
  const priceChangeCbRef = useRef(onAlertPriceChange);

  const [chartReady, setChartReady] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  // Keep callback ref up-to-date without recreating chart
  useEffect(() => { priceChangeCbRef.current = onAlertPriceChange; }, [onAlertPriceChange]);

  // ── Create chart + event listeners (mount only) ─────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, makeChartOpts(el.clientWidth, el.clientHeight));
    const series = chart.addSeries(CandlestickSeries, {
      upColor:       '#26a69a',
      downColor:     '#ef5350',
      borderVisible: false,
      wickUpColor:   '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // ── Auto-resize ──────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(el);

    // ── Helpers ───────────────────────────────────────────────
    const clientY = (e) =>
      e.clientY ?? (e.touches?.[0]?.clientY ?? 0);

    const containerY = (e) =>
      clientY(e) - el.getBoundingClientRect().top;

    const findNearLine = (y) => {
      const s = seriesRef.current;
      if (!s) return null;
      let best = null, bestDist = HIT_PX;
      linesRef.current.forEach(entry => {
        const ly = s.priceToCoordinate(entry.target);
        if (ly == null) return;
        const d = Math.abs(y - ly);
        if (d <= bestDist) { bestDist = d; best = entry; }
      });
      return best;
    };

    // ── Fix 2: prevent price-axis vertical zoom on wheel ─────
    // When the wheel event fires in the rightmost PRICE_AXIS_PX columns,
    // stop it so the price scale doesn't zoom — the user can move the
    // cursor to the chart area for normal wheel-zoom.
    const onWheel = (e) => {
      if (e.offsetX > el.clientWidth - PRICE_AXIS_PX) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // ── Fix 3: draggable price lines ─────────────────────────
    const onMouseMove = (e) => {
      const y = containerY(e);
      if (draggingRef.current) {
        const price = seriesRef.current?.coordinateToPrice(y);
        if (price != null) {
          try { draggingRef.current.line.applyOptions({ price }); } catch {}
          draggingRef.current.currentPrice = price;
        }
        el.style.cursor = 'ns-resize';
        e.stopPropagation();
        return;
      }
      el.style.cursor = findNearLine(y) ? 'ns-resize' : '';
    };

    const onMouseDown = (e) => {
      const y    = containerY(e);
      const hit  = findNearLine(y);
      if (!hit) return;
      draggingRef.current = { ...hit, currentPrice: hit.target };
      el.style.cursor = 'ns-resize';
      e.stopPropagation();
      e.preventDefault();
    };

    const onRelease = () => {
      if (!draggingRef.current) return;
      const { id, currentPrice } = draggingRef.current;
      draggingRef.current = null;
      el.style.cursor = '';
      if (currentPrice != null && priceChangeCbRef.current) {
        const dec = currentPrice > 100 ? 2 : 4;
        priceChangeCbRef.current(id, parseFloat(currentPrice.toFixed(dec)));
      }
    };

    el.addEventListener('wheel',      onWheel,     { passive: false });
    el.addEventListener('mousemove',  onMouseMove);
    el.addEventListener('mousedown',  onMouseDown);
    el.addEventListener('mouseup',    onRelease);
    el.addEventListener('mouseleave', onRelease);

    setChartReady(true);

    return () => {
      ro.disconnect();
      el.removeEventListener('wheel',      onWheel);
      el.removeEventListener('mousemove',  onMouseMove);
      el.removeEventListener('mousedown',  onMouseDown);
      el.removeEventListener('mouseup',    onRelease);
      el.removeEventListener('mouseleave', onRelease);
      setChartReady(false);
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      linesRef.current  = [];
    };
  }, []); // mount only — callback kept fresh via priceChangeCbRef

  // ── Load candles when symbol changes ───────────────────────
  useEffect(() => {
    symRef.current = symbol;
    if (!chartReady || !seriesRef.current) return;

    setLoading(true);
    setError(false);
    linesRef.current.forEach(({ line }) => {
      try { seriesRef.current?.removePriceLine(line); } catch {}
    });
    linesRef.current = [];

    let cancelled = false;
    fetchCandles(symbol)
      .then(candles => {
        if (cancelled || symRef.current !== symbol || !seriesRef.current) return;
        if (!candles.length) { setError(true); return; }
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();
        setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, chartReady]);

  // ── Sync price lines with alerts ────────────────────────────
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return;
    const series = seriesRef.current;

    linesRef.current.forEach(({ line }) => { try { series.removePriceLine(line); } catch {} });
    linesRef.current = [];

    alerts.forEach(alert => {
      try {
        const color = alert.direction === 'above' ? '#D4AF37' : '#ef4444';
        const line  = series.createPriceLine({
          price:            alert.target,
          color,
          lineWidth:        1,
          lineStyle:        LineStyle.Solid,
          axisLabelVisible: false,
          title:            '',
        });
        // Store target so drag detection knows each line's y-coordinate
        linesRef.current.push({ id: alert.id, line, target: alert.target });
      } catch {}
    });
  }, [alerts, chartReady]);

  return (
    <div className="alert-chart-wrap">
      <div ref={containerRef} className="alert-chart-canvas" />
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
