/**
 * BitcoinCandleWidget — v9  (full-width hero overlay)
 * ─────────────────────────────────────────────────────────────
 * • position:absolute — covers full hero card
 * • SVG spans full width (viewBox 600×110), preserveAspectRatio slice
 * • Ball travels from bottom-left → top-right (where big price is)
 * • NO price text in SVG at all
 * • When settled: calls onSettled() so hp-btc-left can fade in
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef } from 'react';
import './BitcoinCandleWidget.css';

const VW = 600, VH = 110;

/* S-curve: starts bottom-left, ends top-right (near price area) */
const PIPE = [
  'M 22,92',
  'C 90,92  118,18  196,18',
  'C 274,18 320,92  398,92',
  'C 476,92 522,18  558,18',
].join(' ');

const MOUTH_X = 22,  MOUTH_Y = 92;
const END_X   = 558, END_Y   = 18;

/* Ball arrives here — near the big price on the right */
const BOX_CX = 548, BOX_CY = 20;

/* Radii */
const BALL_R = 13;
const SPIN_R = 9;

/* Durations */
const ROLL_DUR   = 3200;
const BOUNCE_DUR = 2000;
const SPIN_DUR   = 5000;
const FADE_DUR   = 1000;

export default function BitcoinCandleWidget({ btc, navigate, onSettled }) {
  const pipeRef = useRef(null);
  const rafRef  = useRef(null);
  const started = useRef(false);

  const [pipeLen, setPipeLen] = useState(0);
  const [ballT,   setBallT]   = useState(0);
  const [bounceT, setBounceT] = useState(0);
  const [fadeT,   setFadeT]   = useState(0);
  const [phase,   setPhase]   = useState('init');

  const isUp   = (btc?.change ?? 0) >= 0;
  const color  = isUp ? '#4ade80' : '#f87171';
  const colorD = isUp ? '#14532d' : '#7f1d1d';
  const colorL = isUp ? '#d1fae5' : '#fee2e2';

  /* Measure invisible path */
  useEffect(() => {
    const el = pipeRef.current;
    if (!el) return;
    const l = el.getTotalLength?.() ?? 0;
    if (l > 0) setPipeLen(l);
  }, []);

  /* Full animation sequence */
  useEffect(() => {
    if (!btc || started.current || pipeLen === 0) return;
    started.current = true;

    /* 1 — ROLL */
    setPhase('rolling');
    const t0 = performance.now();

    const rollStep = (now) => {
      const raw = Math.min((now - t0) / ROLL_DUR, 1);
      setBallT(raw);
      if (raw < 1) { rafRef.current = requestAnimationFrame(rollStep); return; }

      /* 2 — BOUNCE — ball arrived: reveal big price immediately */
      onSettled?.();
      setPhase('bouncing');
      const t1 = performance.now();

      const bounceStep = (now2) => {
        const r2 = Math.min((now2 - t1) / BOUNCE_DUR, 1);
        setBounceT(r2);
        if (r2 < 1) { rafRef.current = requestAnimationFrame(bounceStep); return; }

        /* 3 — SPIN for 5 s */
        setPhase('spinning');
        const t2 = performance.now();

        const spinWatch = (now3) => {
          if (now3 - t2 < SPIN_DUR) { rafRef.current = requestAnimationFrame(spinWatch); return; }

          /* 4 — FADE OUT */
          setPhase('fadingout');
          const t3 = performance.now();

          const fadeStep = (now4) => {
            const r4 = Math.min((now4 - t3) / FADE_DUR, 1);
            setFadeT(r4);
            if (r4 < 1) { rafRef.current = requestAnimationFrame(fadeStep); }
            else {
              setPhase('settled');
            }
          };
          rafRef.current = requestAnimationFrame(fadeStep);
        };
        rafRef.current = requestAnimationFrame(spinWatch);
      };
      rafRef.current = requestAnimationFrame(bounceStep);
    };

    rafRef.current = requestAnimationFrame(rollStep);
    return () => cancelAnimationFrame(rafRef.current);
  }, [!!btc, pipeLen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Ball position — rolling */
  let bX = MOUTH_X, bY = MOUTH_Y;
  if (pipeRef.current && pipeLen > 0 && phase === 'rolling') {
    try {
      const pt = pipeRef.current.getPointAtLength(Math.min(ballT, 0.9999) * pipeLen);
      bX = pt.x; bY = pt.y;
    } catch (_) {}
  }

  /* Ball position — bouncing */
  const settle  = 1 - bounceT;
  const bAng    = bounceT * Math.PI * 2 * 4.5;
  const bbX     = BOX_CX + Math.sin(bAng)         * 16 * settle;
  const bbY     = BOX_CY + Math.cos(bAng * 1.618) *  4 * settle;
  const bounceR = BALL_R - (BALL_R - SPIN_R) * bounceT;

  const ballOpa = phase === 'fadingout' ? 1 - fadeT : 1;

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <button
      className="bcw-wrap bcw-wrap--overlay"
      onClick={() => navigate('charts')}
      aria-label="Bitcoin — לחץ לגרף"
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="bcw-svg"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bcw-ball" cx="32%" cy="26%" r="58%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.97)" />
            <stop offset="20%"  stopColor={colorL} />
            <stop offset="55%"  stopColor={color}  />
            <stop offset="100%" stopColor={colorD} />
          </radialGradient>
          <filter id="bcw-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Measurement-only invisible path */}
        <path ref={pipeRef} d={PIPE} fill="none" stroke="none" strokeWidth="0" />

        {/* ══ BALL — rolling ══════════════════════════════════════ */}
        {phase === 'rolling' && (
          <g filter="url(#bcw-glow)">
            <circle cx={bX} cy={bY} r={BALL_R + 7} fill={color} opacity="0.14" />
            <circle cx={bX+1} cy={bY+2} r={BALL_R} fill={colorD} opacity="0.22" />
            <circle cx={bX} cy={bY} r={BALL_R} fill="url(#bcw-ball)" />
          </g>
        )}

        {/* ══ BALL — bouncing behind price ════════════════════════ */}
        {phase === 'bouncing' && (
          <g filter="url(#bcw-glow)">
            <circle cx={bbX} cy={bbY} r={bounceR + 5} fill={color} opacity="0.13" />
            <circle cx={bbX} cy={bbY} r={bounceR} fill="url(#bcw-ball)" />
          </g>
        )}

        {/* ══ BALL — spinning (CSS rotateY) ═══════════════════════ */}
        {phase === 'spinning' && (
          <g style={{ animation:'bcw-spin3d 3s linear infinite',
                      transformBox:'fill-box', transformOrigin:'center' }}>
            <circle cx={BOX_CX} cy={BOX_CY} r={SPIN_R + 4} fill={color} opacity="0.12" />
            <circle cx={BOX_CX} cy={BOX_CY} r={SPIN_R} fill="url(#bcw-ball)" />
          </g>
        )}

        {/* ══ BALL — fading out ════════════════════════════════════ */}
        {phase === 'fadingout' && (
          <g opacity={ballOpa}>
            <circle cx={BOX_CX} cy={BOX_CY} r={SPIN_R + 4} fill={color} opacity="0.12" />
            <circle cx={BOX_CX} cy={BOX_CY} r={SPIN_R} fill="url(#bcw-ball)" />
          </g>
        )}
      </svg>
    </button>
  );
}
