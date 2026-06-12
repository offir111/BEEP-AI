/**
 * BubbleDetail — popup panel when a bubble is clicked
 * Matches cryptobubbles.net detail panel style
 * Works for both crypto (CoinGecko) and stocks (Yahoo Finance)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import './BubbleDetail.css';

const PERIODS = [
  { id: '1h', label: '1H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
];

/* ── Chart drawing on canvas ───────────────────────────────── */
function drawLineChart(canvas, prices, isPositive) {
  if (!canvas || !prices?.length) return;
  const W = canvas.offsetWidth  || 300;
  const H = canvas.offsetHeight || 160;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const pad  = { top: 16, bottom: 28, left: 8, right: 8 };
  const dW   = W - pad.left - pad.right;
  const dH   = H - pad.top  - pad.bottom;

  const min  = Math.min(...prices);
  const max  = Math.max(...prices);
  const rng  = max - min || max * 0.01 || 1;

  const toX  = i => pad.left + (i / (prices.length - 1)) * dW;
  const toY  = v => pad.top  + dH - ((v - min) / rng) * dH;

  const color = isPositive ? '#00e64d' : '#ff4d4d';
  const gCol  = isPositive ? 'rgba(0,230,77,' : 'rgba(255,77,77,';

  /* ── Area fill ── */
  ctx.beginPath();
  prices.forEach((p, i) => {
    const x = toX(i), y = toY(p);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(toX(prices.length - 1), H - pad.bottom);
  ctx.lineTo(toX(0), H - pad.bottom);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
  grad.addColorStop(0,   gCol + '0.22)');
  grad.addColorStop(1,   gCol + '0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  /* ── Line ── */
  ctx.beginPath();
  prices.forEach((p, i) => {
    const x = toX(i), y = toY(p);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.shadowBlur  = 8;
  ctx.shadowColor = color;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  /* ── Last price label ── */
  const lastY = toY(prices.at(-1));
  ctx.beginPath();
  ctx.arc(toX(prices.length - 1), lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = color;
  ctx.font         = `600 11px Inter,system-ui,sans-serif`;
  ctx.fillText(`$${prices.at(-1).toPrecision(5)}`, W - pad.right - 6, lastY - 10);
  ctx.textBaseline = 'alphabetic';
}

/* ── Number formatter ──────────────────────────────────────── */
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtPrice(n) {
  if (n == null) return '—';
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1)     return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

/* ── Component ─────────────────────────────────────────────── */
export default function BubbleDetail({ bubble, asset, coinsData, onClose }) {
  const chartRef = useRef(null);
  const [period,    setPeriod]    = useState('1d');
  const [chartPrices, setChartPrices] = useState(null);
  const [periodPcts,  setPeriodPcts]  = useState({});  // {1h, 1d, 1w, 1m}
  const [loading,   setLoading]   = useState(true);

  /* Get static % changes from already-loaded coin data */
  const staticChanges = useCallback(() => {
    if (asset === 'crypto' && coinsData) {
      const c = coinsData.find(x => x.id === bubble.id);
      if (c) return {
        '1h': c.price_change_percentage_1h_in_currency,
        '1d': c.price_change_percentage_24h,
        '1w': c.price_change_percentage_7d_in_currency,
        '1m': c.price_change_percentage_30d_in_currency,
      };
    }
    return { '1d': bubble.pct };
  }, [asset, coinsData, bubble]);

  /* Fetch chart data for selected period */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setChartPrices(null);

    if (asset === 'crypto') {
      const daysMap = { '1h': 0.042, '1d': 1, '1w': 7, '1m': 30 };
      const days = daysMap[period] || 1;
      fetch(
        `https://api.coingecko.com/api/v3/coins/${bubble.id}/market_chart` +
        `?vs_currency=usd&days=${days}`
      )
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          const prices = (d.prices || []).map(p => p[1]);
          setChartPrices(prices);
          // Also fill period %s from static data
          setPeriodPcts(staticChanges());
        })
        .catch(() => { if (!cancelled) setChartPrices([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      // Stocks — fetch all periods in one shot for the active period chart
      fetch(`/api/stock-detail?symbol=${bubble.symbol}&period=${period}`)
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          setChartPrices(d.prices || []);
          // For stocks we only get 1d % from screener; others from chart
          setPeriodPcts(prev => ({ ...prev, [period]: d.period_pct }));
        })
        .catch(() => { if (!cancelled) setChartPrices([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [asset, bubble.id, bubble.symbol, period, staticChanges]);

  /* Pre-fill with static % changes once */
  useEffect(() => {
    setPeriodPcts(staticChanges());
  }, [staticChanges]);

  /* Draw chart whenever prices update */
  useEffect(() => {
    if (chartPrices?.length) {
      requestAnimationFrame(() => {
        const pct = periodPcts[period] ?? bubble.pct;
        drawLineChart(chartRef.current, chartPrices, pct >= 0);
      });
    }
  }, [chartPrices, period, periodPcts, bubble.pct]);

  const activePct = periodPcts[period] ?? bubble.pct;
  const isUp      = activePct >= 0;

  return (
    <div className="bd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bd-panel">

        {/* Header: symbol + close */}
        <div className="bd-hdr">
          <div className="bd-hdr-left">
            <span className="bd-sym">${bubble.symbol}</span>
            {bubble.name && bubble.name !== bubble.symbol && (
              <span className="bd-name">{bubble.name}</span>
            )}
          </div>
          <button className="bd-close" onClick={onClose}>✕</button>
        </div>

        {/* Price + live % badge */}
        <div className="bd-price-row">
          <span className="bd-price">{fmtPrice(bubble.price)}</span>
          <span className={`bd-pct-badge ${isUp ? 'bd-up' : 'bd-dn'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(activePct).toFixed(2)}%
          </span>
        </div>

        {/* Period tabs — each shows its % change */}
        <div className="bd-periods">
          {PERIODS.map(p => {
            const chg = periodPcts[p.id];
            const hasChg = chg != null;
            const up = hasChg ? chg >= 0 : true;
            return (
              <button
                key={p.id}
                className={`bd-period${period === p.id ? ' bd-period--on' : ''}`}
                onClick={() => setPeriod(p.id)}>
                <span className="bd-period-label">{p.label}</span>
                <span className={`bd-period-pct ${up ? 'bd-up' : 'bd-dn'}`}>
                  {hasChg
                    ? `${up ? '▲' : '▼'}${Math.abs(chg).toFixed(1)}%`
                    : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="bd-chart-wrap">
          {loading && (
            <div className="bd-chart-loading">
              <div className="bd-spin" />
            </div>
          )}
          <canvas ref={chartRef} className="bd-chart" />
        </div>

        {/* Market stats */}
        <div className="bd-stats">
          <div className="bd-stat">
            <span className="bd-stat-lbl">Market Cap</span>
            <span className="bd-stat-val">{fmt(bubble.market_cap)}</span>
          </div>
          <div className="bd-stat">
            <span className="bd-stat-lbl">Volume 24h</span>
            <span className="bd-stat-val">{fmt(bubble.volume)}</span>
          </div>
          {bubble.week52_high && (
            <div className="bd-stat">
              <span className="bd-stat-lbl">52W High</span>
              <span className="bd-stat-val bd-up">{fmtPrice(bubble.week52_high)}</span>
            </div>
          )}
          {bubble.week52_low && (
            <div className="bd-stat">
              <span className="bd-stat-lbl">52W Low</span>
              <span className="bd-stat-val bd-dn">{fmtPrice(bubble.week52_low)}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
