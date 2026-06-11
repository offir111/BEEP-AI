/**
 * BitcoinCandleWidget
 * -------------------
 * Liquid-fill Japanese-candle animation showing live BTC price.
 * - 3-second intro: vessel fills with colored liquid (green=up / red=down)
 * - Settling slosh effect after fill
 * - After settle: static, updates smoothly when price changes
 * - Data: receives `btc` from parent (no extra API calls)
 * - Click: opens charts page
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './BitcoinCandleWidget.css';

/* ── SVG constants ─────────────────────────────────────────── */
const VW = 260, VH = 150;
const VX1 = 14, VX2 = 234, VY1 = 22, VY2 = 130;
const FILL_H = VY2 - VY1;           // 108px fillable height
const WICK_X = VX1 + 112;           // ~126, near vessel center
const WICK_TOP_Y = 4;

/*
 * Vessel silhouette: starts bottom-left, rises (first peak),
 * dips slightly, rises again, flat top-right section, straight right side.
 * This traces a bullish-recovery price pattern as a closed vessel.
 */
const VESSEL = `
  M ${VX1},${VY2}
  L ${VX1},90
  C ${VX1},72 ${VX1+12},49 ${VX1+23},34
  C ${VX1+35},19 ${VX1+53},${VY1} ${VX1+74},${VY1}
  C ${VX1+90},${VY1} ${VX1+98},${VY1+14} ${VX1+108},${VY1+28}
  C ${VX1+116},${VY1+40} ${VX1+120},${VY1+38} ${VX1+130},${VY1+24}
  C ${VX1+144},${VY1+8} ${VX1+162},${VY1+2} ${VX2-20},${VY1+2}
  L ${VX2},${VY1+2}
  L ${VX2},${VY2}
  Z
`.trim().replace(/\n\s+/g, ' ');

/* Sine-wave surface path at liquid top y */
function makeSurface(y) {
  const x0 = VX1 - 6;
  const x1 = VX2 + 6;
  const w  = x1 - x0;
  const h  = 8; // wave height
  return [
    `M ${x0},${y + 4}`,
    `Q ${x0 + w*0.25},${y - h/2} ${x0 + w*0.5},${y + 4}`,
    `Q ${x0 + w*0.75},${y + h + 4} ${x1},${y + 4}`,
    `L ${x1},${y + h + 8}`,
    `Q ${x0 + w*0.75},${y + 4} ${x0 + w*0.5},${y + h + 8}`,
    `Q ${x0 + w*0.25},${y + h*2 + 4} ${x0},${y + h + 8}`,
    `Z`,
  ].join(' ');
}

/* ── Component ─────────────────────────────────────────────── */
export default function BitcoinCandleWidget({ btc, navigate }) {
  const [fillFrac,   setFillFrac]   = useState(0);   // 0–1
  const [dispPrice,  setDispPrice]  = useState(0);
  const [phase,      setPhase]      = useState('init');
  // phases: 'init' | 'filling' | 'settling' | 'settled'

  const startedRef   = useRef(false);
  const rafRef       = useRef(null);
  const timerRef     = useRef(null);
  const prevFracRef  = useRef(0);

  const isUp     = (btc?.change ?? 0) >= 0;
  const clrMain  = isUp ? '#4ade80' : '#f87171';
  const clrDeep  = isUp ? '#14532d' : '#450a0a';
  const clrMid   = isUp ? '#16a34a' : '#dc2626';

  /* Target fill fraction: where current price sits in today's H/L range */
  const targetFrac = useMemo(() => {
    if (!btc?.high || !btc?.low || btc.high === btc.low) return 0.55;
    return Math.min(0.93, Math.max(0.07,
      (btc.price - btc.low) / (btc.high - btc.low)
    ));
  }, [btc?.price, btc?.high, btc?.low]);

  /* Smooth RAF animation from current fill to a target */
  const animateFill = useCallback((fromFrac, toFrac, durationMs, onDone) => {
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const go = (now) => {
      const raw = Math.min((now - t0) / durationMs, 1);
      // ease-out cubic for fill, ease-in-out for live updates
      const e = onDone
        ? 1 - Math.pow(1 - raw, 3)
        : raw < 0.5 ? 2*raw*raw : -1 + (4 - 2*raw)*raw;
      setFillFrac(fromFrac + (toFrac - fromFrac) * e);
      if (raw < 1) rafRef.current = requestAnimationFrame(go);
      else { prevFracRef.current = toFrac; onDone?.(); }
    };
    rafRef.current = requestAnimationFrame(go);
  }, []);

  /* ── Opening animation (runs once when first BTC data arrives) ── */
  useEffect(() => {
    if (!btc || startedRef.current) return;
    startedRef.current = true;
    setPhase('filling');

    const p0 = Math.round(btc.price * 0.94);
    const p1 = Math.round(btc.price);
    const t0 = performance.now();
    const PRICE_DUR = 2800;

    // Price counter animation (runs in parallel)
    const priceAnim = (now) => {
      const raw = Math.min((now - t0) / PRICE_DUR, 1);
      const e   = 1 - Math.pow(1 - raw, 3);
      setDispPrice(Math.round(p0 + (p1 - p0) * e));
      if (raw < 1) requestAnimationFrame(priceAnim);
    };
    requestAnimationFrame(priceAnim);

    // Liquid fill animation
    animateFill(0, targetFrac, 2900, () => {
      setPhase('settling');
      timerRef.current = setTimeout(() => {
        setPhase('settled');
        prevFracRef.current = targetFrac;
      }, 1500);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [!!btc]); // eslint-disable-line

  /* ── Live price updates (after settled) ── */
  useEffect(() => {
    if (phase !== 'settled' || !btc) return;
    setDispPrice(Math.round(btc.price));
    animateFill(prevFracRef.current, targetFrac, 750, null);
  }, [btc?.price, phase, targetFrac, animateFill]);

  /* ── Computed geometry ── */
  const liquidTopY = VY2 - fillFrac * FILL_H;
  const surfacePath = makeSurface(liquidTopY);

  const waveClass =
    phase === 'filling'  ? 'bcw-wave-fill' :
    phase === 'settling' ? 'bcw-wave-settle' : '';

  const fmtPrice = (p) =>
    Math.round(p).toLocaleString('en-US');

  return (
    <button
      className="bcw-wrap"
      onClick={() => navigate('charts')}
      aria-label="מחיר Bitcoin — לחץ לגרף"
      dir="ltr"
    >
      {/* ── SVG Candle ── */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="bcw-svg"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Clip liquid to vessel shape */}
          <clipPath id="bcw-vessel-clip">
            <path d={VESSEL} />
          </clipPath>

          {/* Liquid gradient */}
          <linearGradient id="bcw-liq-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={clrMain} stopOpacity="0.90" />
            <stop offset="100%" stopColor={clrDeep} stopOpacity="0.60" />
          </linearGradient>

          {/* Shine overlay */}
          <linearGradient id="bcw-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
          </linearGradient>

          {/* Glow filter */}
          <filter id="bcw-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Top wick */}
        <line
          x1={WICK_X} y1={WICK_TOP_Y} x2={WICK_X} y2={VY1 + 2}
          stroke={clrMain} strokeWidth="2.5" strokeLinecap="round"
          opacity="0.65" filter="url(#bcw-glow)"
        />

        {/* Vessel outline (transparent inside, glowing stroke) */}
        <path
          d={VESSEL}
          fill="rgba(255,255,255,0.020)"
          stroke={clrMain}
          strokeWidth="1.5"
          strokeOpacity="0.45"
        />

        {/* Liquid layers (clipped to vessel) */}
        <g clipPath="url(#bcw-vessel-clip)">
          {/* Base fill */}
          <rect
            x={VX1} y={liquidTopY}
            width={VX2 - VX1} height={VY2 - liquidTopY + 8}
            fill="url(#bcw-liq-grad)"
          />
          {/* Shine pass */}
          <rect
            x={VX1} y={liquidTopY}
            width={VX2 - VX1} height={VY2 - liquidTopY + 8}
            fill="url(#bcw-shine)"
            opacity="0.45"
          />
          {/* Wave surface */}
          {fillFrac > 0.04 && (
            <path
              d={surfacePath}
              fill={clrMain}
              opacity="0.55"
              className={waveClass}
            />
          )}
        </g>

        {/* Bottom wick */}
        <line
          x1={WICK_X} y1={VY2} x2={WICK_X} y2={VH - 4}
          stroke={clrMain} strokeWidth="2.5" strokeLinecap="round"
          opacity="0.40"
        />

        {/* Price label inside SVG (appears after half-fill) */}
        {fillFrac > 0.35 && (
          <text
            x={VX2 - 22} y={liquidTopY + 16}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fontFamily="'Courier New', monospace"
            fill={clrMain}
            opacity="0.80"
          >
            ${fmtPrice(dispPrice)}
          </text>
        )}
      </svg>

      {/* ── Price info panel ── */}
      <div className="bcw-info">
        <div className="bcw-coin">₿ Bitcoin</div>

        <div className="bcw-big-price" style={{ color: clrMain }}>
          ${fmtPrice(dispPrice)}
        </div>
        <div className="bcw-change" style={{ color: clrMain }}>
          {isUp ? '▲' : '▼'} {btc ? Math.abs(btc.change).toFixed(2) : '—'}%
          <span className="bcw-label-24h">24H</span>
        </div>

        {/* Vertical price scale: H → current → L */}
        {btc && (
          <div className="bcw-scale">
            <div className="bcw-scale-row bcw-scale-top">
              <span className="bcw-tick" />
              <span className="bcw-scale-val">
                ${fmtPrice(btc.high)}
              </span>
              <span className="bcw-scale-badge bcw-scale-h">H</span>
            </div>

            <div className="bcw-scale-track">
              {/* Thin vertical line */}
              <div className="bcw-scale-line" />
              {/* Current price pointer */}
              <div
                className="bcw-scale-ptr"
                style={{
                  top: `${Math.max(0, Math.min(100, (1 - fillFrac / 0.93) * 100))}%`,
                  color: clrMain,
                  transition: phase === 'settled' ? 'top 0.85s ease' : 'none',
                }}
              >
                <span className="bcw-scale-ptr-arr">◀</span>
                <span className="bcw-scale-ptr-val">${fmtPrice(dispPrice)}</span>
              </div>
            </div>

            <div className="bcw-scale-row bcw-scale-bot">
              <span className="bcw-tick" />
              <span className="bcw-scale-val">
                ${fmtPrice(btc.low)}
              </span>
              <span className="bcw-scale-badge bcw-scale-l">L</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom label */}
      <div className="bcw-chart-hint" aria-hidden="true">
        📊 גרף נרות
      </div>
    </button>
  );
}
