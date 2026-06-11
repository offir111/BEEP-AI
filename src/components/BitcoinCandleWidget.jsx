/**
 * BitcoinCandleWidget — S-tube + rolling ball, v4
 * ──────────────────────────────────────────────────
 * 1. Pipe starts empty, ball appears at mouth
 * 2. Liquid fills, ball rides at the liquid front (pushed by liquid)
 * 3. Ball reaches the funnel → enters the price box for ~1 s
 * 4. Ball fades out → only full-color pipe + price box remain
 *
 * Liquid levels: fills to targetFrac = (price - low)/(high - low)
 * Ball:          always travels full pipe (0→1) regardless of level
 * Price counter: counts from 0 in sync with liquid fill
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './BitcoinCandleWidget.css';

/* ── Layout ─────────────────────────────────────── */
const VW = 630, VH = 148;

// Perfect S-curve: horizontal tangents at every peak/valley (no kinks)
const PIPE = [
  'M 28,128',
  'C 90,128  115,18  170,18',
  'C 225,18  275,128  320,128',
  'C 365,128 420,18   460,18',
].join(' ');

const MOUTH_X = 28,  MOUTH_Y = 128;   // pipe start
const END_X   = 460, END_Y   = 18;    // pipe end  (funnel left)

// Funnel — tapers from pipe diameter (30 px) to box height (46 px)
const PIPE_HALF = 15;  // PIPE_BG_W / 2
const BOX_Y     = 4,  BOX_H = 46;    // price box top + height
const FUNNEL_X2 = 474;               // funnel right / box left
const FUNNEL_PATH = [
  `M ${END_X},${END_Y - PIPE_HALF}`,    // pipe top edge
  `L ${FUNNEL_X2},${BOX_Y}`,            // box top edge
  `L ${FUNNEL_X2},${BOX_Y + BOX_H}`,    // box bottom edge
  `L ${END_X},${END_Y + PIPE_HALF}`,    // pipe bottom edge
  'Z',
].join(' ');

// Price box
const BOX_X  = FUNNEL_X2;
const BOX_W  = 150;
const BOX_CX = BOX_X + BOX_W / 2;  // horizontal center
const BOX_CY = BOX_Y + BOX_H / 2;  // vertical center  (= 27)

// Stroke widths
const PIPE_BG_W     = 30;
const PIPE_LIQ_W    = 22;
const PIPE_TOP_HI_W = 6;
const EDGE_LEN      = 80;     // "last cm" solid-color front (path-units)
const BALL_R        = 10;

/* ── Component ──────────────────────────────────── */
export default function BitcoinCandleWidget({ btc, navigate }) {
  const pipeRef  = useRef(null);
  const rafRef   = useRef(null);
  const boxRafRef = useRef(null);
  const timerRef = useRef(null);
  const prevLiqRef = useRef(0);

  const [pipeLen,   setPipeLen]   = useState(0);
  const [rollFrac,  setRollFrac]  = useState(0);  // 0→1 ball on pipe
  const [liqFrac,   setLiqFrac]   = useState(0);  // 0→targetFrac liquid
  const [phase,     setPhase]     = useState('init');
  // 'init' | 'rolling' | 'inbox' | 'settling' | 'settled'
  const [ballBoxT,  setBallBoxT]  = useState(0);  // 0→1 in-box timer
  const [dispPrice, setDispPrice] = useState(0);

  const startedRef = useRef(false);

  const isUp        = (btc?.change ?? 0) >= 0;
  const color       = isUp ? '#4ade80' : '#f87171';
  const colorDark   = isUp ? '#14532d' : '#7f1d1d';
  const colorBright = isUp ? '#bbf7d0' : '#fecaca';

  const targetFrac = useMemo(() => {
    if (!btc?.high || !btc?.low || btc.high === btc.low) return 0.55;
    return Math.min(0.95, Math.max(0.05,
      (btc.price - btc.low) / (btc.high - btc.low)
    ));
  }, [btc?.price, btc?.high, btc?.low]);

  /* Measure path length once, after mount */
  useEffect(() => {
    if (pipeRef.current) {
      const len = pipeRef.current.getTotalLength();
      if (len > 0) setPipeLen(len);
    }
  }, []);

  /* Price counter — synced to liqFrac during animation */
  useEffect(() => {
    if (!btc) return;
    if (phase === 'settled') { setDispPrice(Math.round(btc.price)); return; }
    if (phase === 'rolling' || phase === 'inbox') {
      const frac = targetFrac > 0 ? Math.min(liqFrac / targetFrac, 1) : liqFrac;
      setDispPrice(Math.round(btc.price * frac));
    }
  }, [liqFrac, phase, btc?.price, targetFrac]); // eslint-disable-line

  /* Liquid-only animator (used for post-settle live updates) */
  const animLiq = useCallback((from, to, dur, easeType, done) => {
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const step = (now) => {
      const raw = Math.min((now - t0) / dur, 1);
      const e = easeType === 'out3'
        ? 1 - Math.pow(1 - raw, 3)
        : (raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw);
      setLiqFrac(from + (to - from) * e);
      if (raw < 1) rafRef.current = requestAnimationFrame(step);
      else { prevLiqRef.current = to; done?.(); }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  /* ── Opening animation ── */
  useEffect(() => {
    if (!btc || startedRef.current || pipeLen === 0) return;
    startedRef.current = true;
    setPhase('rolling');

    const ROLL_DUR = 5000;   // ms — ball crosses the full pipe (slow, uniform)
    const BOX_DUR  = 1450;   // ms — ball enters box, holds, fades

    const t0 = performance.now();

    // Phase 1: ball rolls 0→1 at CONSTANT SPEED (linear),
    // liquid fills behind it up to targetFrac — no burst fill at the start.
    const rollStep = (now) => {
      const raw = Math.min((now - t0) / ROLL_DUR, 1);
      const e   = raw; // linear — uniform speed throughout
      setRollFrac(e);
      setLiqFrac(Math.min(e, targetFrac));
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(rollStep);
      } else {
        // Ball reached pipe end → start inbox phase
        setPhase('inbox');
        setLiqFrac(targetFrac);

        // Phase 2: ball moves through funnel into box, then fades
        const t1 = performance.now();
        const boxStep = (now2) => {
          const raw2 = Math.min((now2 - t1) / BOX_DUR, 1);
          setBallBoxT(raw2);
          if (raw2 < 1) {
            boxRafRef.current = requestAnimationFrame(boxStep);
          } else {
            setPhase('settling');
            setDispPrice(Math.round(btc.price));
            prevLiqRef.current = targetFrac;

            // Liquid settling oscillation
            const tf = targetFrac;
            const seq = [
              [tf, tf + 0.020, 190, 'inout'],
              [tf + 0.020, tf - 0.012, 265, 'inout'],
              [tf - 0.012, tf + 0.007, 235, 'inout'],
              [tf + 0.007, tf,          195, 'inout'],
            ];
            let si = 0;
            const runSeq = () => {
              if (si >= seq.length) { setPhase('settled'); return; }
              const [fr, to, dur, ease] = seq[si++];
              animLiq(fr, to, dur, ease, runSeq);
            };
            timerRef.current = setTimeout(runSeq, 40);
          }
        };
        boxRafRef.current = requestAnimationFrame(boxStep);
      }
    };
    rafRef.current = requestAnimationFrame(rollStep);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(boxRafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [!!btc, pipeLen]); // eslint-disable-line

  /* ── Live updates after settled ── */
  useEffect(() => {
    if (phase !== 'settled' || !btc) return;
    setDispPrice(Math.round(btc.price));
    animLiq(prevLiqRef.current, targetFrac, 750, 'inout', null);
  }, [btc?.price, phase, targetFrac, animLiq]);

  /* ── Ball position on S-curve ── */
  let ballX = MOUTH_X, ballY = MOUTH_Y;
  if (pipeRef.current && pipeLen > 0 && phase === 'rolling') {
    try {
      const pt = pipeRef.current.getPointAtLength(
        Math.min(Math.max(rollFrac, 0), 0.9999) * pipeLen
      );
      ballX = pt.x; ballY = pt.y;
    } catch (_) { /* keep defaults */ }
  }

  /* ── Ball in-box interpolation ── */
  const ENTER_END   = 0.22;   // ballBoxT fraction when ball reaches box center
  const FADE_START  = 0.82;   // ballBoxT fraction when fade begins
  let boxBX = BOX_CX, boxBY = BOX_CY, boxBOpa = 0, boxBScale = 0;
  if (phase === 'inbox') {
    if (ballBoxT <= ENTER_END) {
      const t = ballBoxT / ENTER_END;
      const e = 1 - Math.pow(1 - t, 3);
      boxBX     = END_X  + (BOX_CX - END_X)  * e;
      boxBY     = END_Y  + (BOX_CY - END_Y)  * e;
      boxBOpa   = 1.0;
      boxBScale = 0.55 + 0.45 * e;
    } else if (ballBoxT < FADE_START) {
      boxBX = BOX_CX; boxBY = BOX_CY; boxBOpa = 1.0; boxBScale = 1.0;
    } else {
      const t = (ballBoxT - FADE_START) / (1 - FADE_START);
      boxBX = BOX_CX; boxBY = BOX_CY;
      boxBOpa   = 1 - t;
      boxBScale = 1 - 0.35 * t;
    }
  }

  /* ── Derived SVG values ── */
  const DA = pipeLen || 2000;
  const DO = DA * (1 - liqFrac);

  const edgeStart   = Math.max(0, liqFrac * DA - EDGE_LEN);
  const edgeLenReal = Math.min(EDGE_LEN, liqFrac * DA);

  // Funnel fills as ball approaches pipe end
  const funnelFillOpa = Math.max(0, Math.min(1, (rollFrac - 0.90) / 0.10));

  const fmtP = (p) => Math.round(p).toLocaleString('en-US');

  return (
    <button
      className="bcw-wrap"
      onClick={() => navigate('charts')}
      aria-label="מחיר Bitcoin — לחץ לגרף"
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="bcw-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* 3-D cylinder: vertical gradient (top=bright, bottom=dark) */}
          <linearGradient id="bcw-3d"
            x1="0" y1="18" x2="0" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%"    stopColor={colorBright} stopOpacity="0.88" />
            <stop offset="12%"   stopColor={colorBright} stopOpacity="0.65" />
            <stop offset="32%"   stopColor={color}       stopOpacity="0.97" />
            <stop offset="58%"   stopColor={color}       stopOpacity="0.92" />
            <stop offset="78%"   stopColor={colorDark}   stopOpacity="0.82" />
            <stop offset="100%"  stopColor="rgba(0,0,0,0.55)" />
          </linearGradient>

          {/* Shadow underlayer */}
          <linearGradient id="bcw-shd"
            x1="0" y1="18" x2="0" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={colorDark} stopOpacity="0.04" />
            <stop offset="55%"  stopColor={colorDark} stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.46)" />
          </linearGradient>

          {/* Ball: radial gradient → 3-D sphere illusion */}
          <radialGradient id="bcw-ball" cx="33%" cy="27%" r="62%">
            <stop offset="0%"    stopColor="rgba(255,255,255,0.96)" />
            <stop offset="22%"   stopColor={colorBright} stopOpacity="0.90" />
            <stop offset="56%"   stopColor={color} />
            <stop offset="100%"  stopColor={colorDark} />
          </radialGradient>

          {/* Soft glow */}
          <filter id="bcw-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ball-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ════════════════════════════════
            S-PIPE TUBE STRUCTURE — black/dark empty pipe
            ════════════════════════════════ */}
        {/* Dark outer border ring */}
        <path d={PIPE} fill="none" strokeLinecap="round"
          stroke="rgba(0,0,0,0.55)" strokeWidth={PIPE_BG_W + 6} />
        {/* Tube body — black/dark so empty pipe looks solid black */}
        <path d={PIPE} fill="none" strokeLinecap="round"
          stroke="rgba(12,10,24,0.92)" strokeWidth={PIPE_BG_W} />
        {/* Subtle inner highlight (tube wall shine) */}
        <path d={PIPE} fill="none" strokeLinecap="round"
          stroke="rgba(255,255,255,0.06)" strokeWidth={PIPE_BG_W - 10} />

        {/* ════════════════════════════════
            LIQUID — only rendered once liqFrac > 0
            (hard guard prevents any colour before animation)
            ════════════════════════════════ */}
        {/* Invisible measurement path — always present so getTotalLength() works */}
        <path ref={pipeRef} d={PIPE} fill="none" stroke="none" strokeWidth="0" />

        {liqFrac > 0.001 && (
          <>
            {/* Shadow underlayer */}
            <path d={PIPE} fill="none" strokeLinecap="round"
              stroke="url(#bcw-shd)" strokeWidth={PIPE_LIQ_W + 4}
              strokeDasharray={`${DA}`} strokeDashoffset={`${DO}`} />
            {/* Main 3D body */}
            <path d={PIPE} fill="none" strokeLinecap="round"
              stroke="url(#bcw-3d)" strokeWidth={PIPE_LIQ_W}
              strokeDasharray={`${DA}`} strokeDashoffset={`${DO}`} />
            {/* Top specular highlight */}
            {liqFrac > 0.02 && (
              <path d={PIPE} fill="none" strokeLinecap="round"
                stroke={colorBright} strokeWidth={PIPE_TOP_HI_W}
                strokeOpacity="0.36"
                strokeDasharray={`${DA}`} strokeDashoffset={`${DO}`} />
            )}
            {/* Soft glow around liquid */}
            {liqFrac > 0.03 && (
              <path d={PIPE} fill="none" strokeLinecap="round"
                stroke={color} strokeWidth={PIPE_LIQ_W + 14}
                strokeDasharray={`${DA}`} strokeDashoffset={`${DO}`}
                opacity="0.06" />
            )}
            {/* Leading edge: solid full-color front */}
            {edgeLenReal > 1 && (
              <>
                <path d={PIPE} fill="none" strokeLinecap="round"
                  stroke={color} strokeWidth={PIPE_LIQ_W + 18}
                  strokeDasharray={`${edgeStart} ${edgeLenReal} ${DA}`}
                  opacity="0.15" />
                <path d={PIPE} fill="none" strokeLinecap="round"
                  stroke={color} strokeWidth={PIPE_LIQ_W}
                  strokeDasharray={`${edgeStart} ${edgeLenReal} ${DA}`} />
                <path d={PIPE} fill="none" strokeLinecap="round"
                  stroke={colorBright} strokeWidth={PIPE_TOP_HI_W}
                  strokeDasharray={`${edgeStart} ${edgeLenReal} ${DA}`}
                  strokeOpacity="0.68" />
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════
            FUNNEL (pipe end → price box)
            ════════════════════════════════ */}
        {/* Structure always visible */}
        <path d={FUNNEL_PATH}
          fill="rgba(255,255,255,0.040)"
          stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
        {/* Liquid fill inside funnel as ball passes through */}
        {funnelFillOpa > 0 && (
          <path d={FUNNEL_PATH}
            fill={color}
            opacity={funnelFillOpa * 0.50} />
        )}

        {/* ════════════════════════════════
            PIPE MOUTH — circular opening
            ════════════════════════════════ */}
        <circle cx={MOUTH_X} cy={MOUTH_Y} r="17"
          fill="rgba(6,6,18,0.70)"
          stroke={color} strokeWidth="1.5" strokeOpacity="0.38" />
        <circle cx={MOUTH_X} cy={MOUTH_Y} r="11"
          fill="rgba(255,255,255,0.030)"
          stroke={color} strokeWidth="1" strokeOpacity="0.55" />
        {liqFrac > 0.015 && (
          <circle cx={MOUTH_X} cy={MOUTH_Y} r="10"
            fill={color} opacity={Math.min(liqFrac * 5, 0.88)}
            filter="url(#bcw-glow)" />
        )}

        {/* ════════════════════════════════
            BALL rolling along S-curve
            ════════════════════════════════ */}
        {phase === 'rolling' && (
          <>
            {/* Outer glow halo */}
            <circle cx={ballX} cy={ballY} r={BALL_R + 7}
              fill={color} opacity="0.18" filter="url(#ball-glow)" />
            {/* Drop shadow for depth */}
            <circle cx={ballX + 1.8} cy={ballY + 1.8} r={BALL_R}
              fill={colorDark} opacity="0.38" />
            {/* Sphere */}
            <circle cx={ballX} cy={ballY} r={BALL_R}
              fill="url(#bcw-ball)" />
          </>
        )}

        {/* ════════════════════════════════
            PRICE BOX
            ════════════════════════════════ */}
        {/* Box background */}
        <rect x={BOX_X} y={BOX_Y} width={BOX_W} height={BOX_H} rx="9"
          fill="rgba(7,7,22,0.86)"
          stroke={color} strokeWidth="0.8" strokeOpacity="0.32" />

        {/* Ball INSIDE the box (rendered before text so text is always readable) */}
        {phase === 'inbox' && boxBOpa > 0.01 && (
          <>
            <circle cx={boxBX} cy={boxBY}
              r={14 * boxBScale}
              fill={color} opacity={boxBOpa * 0.18} />
            <circle cx={boxBX} cy={boxBY}
              r={11 * boxBScale}
              fill="url(#bcw-ball)"
              opacity={boxBOpa} />
          </>
        )}

        {/* Price counter — runs from 0 in sync with liquid fill */}
        <text x={BOX_CX} y={BOX_CY - 4}
          textAnchor="middle"
          fontSize="15" fontWeight="800"
          fontFamily="'Courier New', monospace"
          fill={color}>
          ${fmtP(dispPrice)}
        </text>

        {/* Change % only — no "24H" */}
        <text x={BOX_CX} y={BOX_CY + 12}
          textAnchor="middle"
          fontSize="11" fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
          fill={color} opacity="0.80">
          {isUp ? '▲' : '▼'} {btc ? Math.abs(btc.change).toFixed(2) : '—'}%
        </text>

        {/* Chart hint */}
        <text x={VW - 8} y={VH - 4} textAnchor="end"
          fontSize="7.5" fill="rgba(255,255,255,0.15)" fontWeight="600">
          📊 גרף נרות ◀
        </text>
      </svg>
    </button>
  );
}
