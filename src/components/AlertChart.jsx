/**
 * AlertChart.jsx — Lightweight Charts with draggable alert price lines.
 *
 * Features:
 *  1. Right-edge buffer (rightOffset:10)
 *  2. Price-axis wheel zoom disabled
 *  3. Draggable price lines
 *  4. Floating price badge centered on each line (HTML overlay)
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
      rightOffset:    10,
      fixRightEdge:   false,
      fixLeftEdge:    false,
    },
    handleScale: {
      mouseWheel:           true,
      pinch:                true,
      axisPressedMouseMove: { time: true, price: false },
    },
    handleScroll: {
      mouseWheel:       true,
      pressedMouseMove: true,
      horzTouchDrag:    true,
      vertTouchDrag:    false,
    },
  };
}

// Format price for badge label
function fmtPrice(p) {
  if (p == null || isNaN(p)) return '';
  if (p >= 10000) return '$' + Math.round(p).toLocaleString('en-US');
  if (p >= 100)   return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)     return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

const HIT_PX       = 7;
const PRICE_AXIS_PX = 75;

export default function AlertChart({ symbol, alerts = [], onAlertPriceChange }) {
  const containerRef         = useRef(null);
  const chartRef             = useRef(null);
  const seriesRef            = useRef(null);
  const linesRef             = useRef([]);        // { id, line, target, labelEl, color }[]
  const symRef               = useRef(symbol);
  const draggingRef          = useRef(null);      // { id, line, currentPrice, labelEl }
  const priceChangeCbRef     = useRef(onAlertPriceChange);
  const updatePositionsRef   = useRef(null);      // called from chart subscriptions

  const [chartReady, setChartReady] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  // Keep callback ref up-to-date
  useEffect(() => { priceChangeCbRef.current = onAlertPriceChange; }, [onAlertPriceChange]);

  // ── Reposition all label badges ────────────────────────────
  const buildUpdatePositions = () => () => {
    const s  = seriesRef.current;
    const el = containerRef.current;
    if (!s || !el) return;
    const chartH = el.clientHeight;
    linesRef.current.forEach(entry => {
      if (!entry.labelEl) return;
      const y = s.priceToCoordinate(entry.target);
      if (y == null || y < 4 || y > chartH - 4) {
        entry.labelEl.style.display = 'none';
        return;
      }
      entry.labelEl.style.display = 'flex';
      entry.labelEl.style.top     = `${y}px`;
    });
  };

  // ── Create chart + event listeners (mount only) ─────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart  = createChart(el, makeChartOpts(el.clientWidth, el.clientHeight));
    const series = chart.addSeries(CandlestickSeries, {
      upColor:       '#26a69a',
      downColor:     '#ef5350',
      borderVisible: false,
      wickUpColor:   '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // Build the reposition function once and store in ref
    updatePositionsRef.current = buildUpdatePositions();

    // ── Auto-resize ──────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      updatePositionsRef.current?.();
    });
    ro.observe(el);

    // ── Subscribe to chart time scale changes (re-position labels) ──
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      updatePositionsRef.current?.();
    });
    chart.subscribeCrosshairMove(() => {
      updatePositionsRef.current?.();
    });

    // ── Helpers ───────────────────────────────────────────────
    const containerY = (e) =>
      (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - el.getBoundingClientRect().top;

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

    // ── Fix: prevent price-axis vertical zoom on wheel ───────
    const onWheel = (e) => {
      if (e.offsetX > el.clientWidth - PRICE_AXIS_PX) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // ── Draggable price lines ─────────────────────────────────
    const onMouseMove = (e) => {
      const y = containerY(e);
      if (draggingRef.current) {
        const price = seriesRef.current?.coordinateToPrice(y);
        if (price != null) {
          try { draggingRef.current.line.applyOptions({ price }); } catch {}
          draggingRef.current.currentPrice = price;
          // Update the badge label live while dragging
          if (draggingRef.current.labelEl) {
            draggingRef.current.labelEl.style.top = `${y}px`;
            const txt = draggingRef.current.labelEl.querySelector('.acl-price');
            if (txt) txt.textContent = fmtPrice(price);
          }
        }
        el.style.cursor = 'ns-resize';
        e.stopPropagation();
        return;
      }
      el.style.cursor = findNearLine(y) ? 'ns-resize' : '';
    };

    const onMouseDown = (e) => {
      const y   = containerY(e);
      const hit = findNearLine(y);
      if (!hit) return;
      draggingRef.current = { ...hit, currentPrice: hit.target };
      el.style.cursor = 'ns-resize';
      e.stopPropagation();
      e.preventDefault();
    };

    const onRelease = () => {
      if (!draggingRef.current) return;
      const { id, currentPrice } = draggingRef.current;
      // Sync stored target so label stays positioned correctly
      const entry = linesRef.current.find(x => x.id === id);
      if (entry && currentPrice != null) entry.target = currentPrice;
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
      // Remove any lingering label els
      linesRef.current.forEach(({ labelEl }) => {
        if (labelEl?.parentNode) labelEl.parentNode.removeChild(labelEl);
      });
      linesRef.current = [];
      setChartReady(false);
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load candles when symbol changes ───────────────────────
  useEffect(() => {
    symRef.current = symbol;
    if (!chartReady || !seriesRef.current) return;

    setLoading(true);
    setError(false);
    // Remove lines + labels
    linesRef.current.forEach(({ line, labelEl }) => {
      try { seriesRef.current?.removePriceLine(line); } catch {}
      if (labelEl?.parentNode) labelEl.parentNode.removeChild(labelEl);
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

  // ── Sync price lines + floating badges with alerts ─────────
  useEffect(() => {
    if (!chartReady || !seriesRef.current || !containerRef.current) return;
    const series = seriesRef.current;
    const container = containerRef.current;

    // Remove old lines + labels
    linesRef.current.forEach(({ line, labelEl }) => {
      try { series.removePriceLine(line); } catch {}
      if (labelEl?.parentNode) labelEl.parentNode.removeChild(labelEl);
    });
    linesRef.current = [];

    alerts.forEach(alert => {
      try {
        const color = alert.direction === 'above' ? '#D4AF37' : '#ef4444';

        // Create price line (no axis label — we use our own badge)
        const line = series.createPriceLine({
          price:            alert.target,
          color,
          lineWidth:        1,
          lineStyle:        LineStyle.Solid,
          axisLabelVisible: false,
          title:            '',
        });

        // ── Create floating price badge ──────────────────────
        const labelEl = document.createElement('div');
        labelEl.className = 'acl-badge';
        labelEl.style.borderColor = color;
        labelEl.innerHTML =
          `<span class="acl-price">${fmtPrice(alert.target)}</span>`;
        container.appendChild(labelEl);

        linesRef.current.push({ id: alert.id, line, target: alert.target, labelEl, color });
      } catch {}
    });

    // Position badges immediately after adding
    updatePositionsRef.current?.();
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
