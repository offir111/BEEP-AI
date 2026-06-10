/**
 * AlertChart.jsx — TradingView Lightweight Charts with exact alert price lines.
 *
 * Replaces the iframe embed for AlertsPage.
 * Price lines are drawn at EXACT prices — not approximated.
 *
 * Data sources:
 *   • Crypto (BTC/ETH/SOL/…) → Binance klines (free, no auth)
 *   • Stocks / GOLD          → /api/candles  (Yahoo Finance proxy)
 */
import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, CrosshairMode, LineStyle } from 'lightweight-charts';
import './AlertChart.css';

// ── Binance symbols ───────────────────────────────────────────
const BINANCE = {
  BTC:  'BTCUSDT', ETH:  'ETHUSDT', SOL:  'SOLUSDT', BNB:  'BNBUSDT',
  XRP:  'XRPUSDT', DOGE: 'DOGEUSDT', ADA:  'ADAUSDT', AVAX: 'AVAXUSDT',
};

// ── Fetch OHLCV candles ───────────────────────────────────────
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

  // Stocks / GOLD (GC=F)
  const yf = s === 'GOLD' ? 'GC=F' : s;
  const r  = await fetch(`/api/candles?symbol=${encodeURIComponent(yf)}`);
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d.candles) ? d.candles : [];
}

// ── Chart options (dark, beep-ai palette) ─────────────────────
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
    },
    timeScale: {
      borderColor:    '#1e1e3a',
      timeVisible:    true,
      secondsVisible: false,
      rightOffset:    6,
    },
    handleScale:  true,
    handleScroll: true,
  };
}

// ── Component ─────────────────────────────────────────────────
export default function AlertChart({ symbol, alerts = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const linesRef     = useRef([]);      // { id, line }[]
  const symRef       = useRef(symbol);

  const [chartReady, setChartReady] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  // ── Create chart on mount ───────────────────────────────────
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

    // Auto-resize
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(el);

    setChartReady(true);

    return () => {
      ro.disconnect();
      setChartReady(false);
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      linesRef.current  = [];
    };
  }, []);

  // ── Load candles when symbol changes ───────────────────────
  useEffect(() => {
    symRef.current = symbol;
    if (!chartReady || !seriesRef.current) return;

    setLoading(true);
    setError(false);

    // Clear existing price lines
    linesRef.current.forEach(({ line }) => {
      try { seriesRef.current?.removePriceLine(line); } catch {}
    });
    linesRef.current = [];

    let cancelled = false;
    fetchCandles(symbol)
      .then(candles => {
        if (cancelled || symRef.current !== symbol || !seriesRef.current) return;
        if (candles.length === 0) { setError(true); return; }
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

    // Remove all old lines
    linesRef.current.forEach(({ line }) => {
      try { series.removePriceLine(line); } catch {}
    });
    linesRef.current = [];

    // Draw exact price lines
    alerts.forEach(alert => {
      try {
        const isAbove = alert.direction === 'above';
        const color   = isAbove ? '#D4AF37' : '#ef4444';
        const line    = series.createPriceLine({
          price:            alert.target,
          color,
          lineWidth:        2,
          lineStyle:        LineStyle.Dashed,
          axisLabelVisible: true,
          title:            `🔔 ${alert.target.toLocaleString()}`,
        });
        linesRef.current.push({ id: alert.id, line });
      } catch {}
    });
  }, [alerts, chartReady]);

  return (
    <div className="alert-chart-wrap">
      {/* The Lightweight Charts canvas */}
      <div ref={containerRef} className="alert-chart-canvas" />

      {/* Loading spinner */}
      {loading && !error && (
        <div className="alert-chart-overlay">
          <div className="alert-chart-spinner" />
          <span>{symbol}</span>
        </div>
      )}

      {/* Error fallback */}
      {error && (
        <div className="alert-chart-overlay">
          <span className="alert-chart-err">⚠ לא ניתן לטעון נתוני {symbol}</span>
        </div>
      )}
    </div>
  );
}
