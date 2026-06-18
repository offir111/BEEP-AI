/**
 * ScannerWidget — AI scanning animation
 * mode: 'anim' | 'bubbles' | 'search'
 *
 *  Click animation card → bubbles (CryptoBubbles)
 *  Click "סריקה ידנית" in bubbles → search form
 *  Click "ביטול" in search → back to anim
 */
import { useState, useEffect, useRef } from 'react';
import './ScannerWidget.css';
import BubbleChart from './BubbleChart';
import { apiUrl } from '../utils/apiBase';

const BAR_GRAD = 'linear-gradient(90deg,#1e90ff 0%,#1565c0 55%,#071e45 100%)';
const CLIMB_MS = 9750;

// ── Ambient preview: 7 faint BLUE 1H-crypto bubbles drifting behind the orb ──
// A subtle hint of "what's behind the scanner". Real 1H movers, blue-filtered (not
// their own colors), ~20% opacity; only the single biggest mover pulses up to ~50%.
// Fades in 3s after entering. Sits behind the animation (z-index 0) — never hides it.
// 20 bubbles to fill the panel: 2 large · 2 medium · the rest small (slightly varied)
const BUB_SIZES = [
  76, 70, 50, 46,
  34, 32, 30, 30, 28, 28, 26, 32, 28, 30, 26, 34, 28, 30, 26, 32,
];
const OP_CHOICES  = [0.2, 0.3, 0.4];        // random per-bubble brightness (up to 40%)
const REVEAL_STEPS = [1, 3, 4, 7, 20];      // cumulative count shown each 1s: +1,+2,+1,+3,+rest

function ScannerBubblesBg() {
  const [bubbles, setBubbles]   = useState([]);
  const [revealed, setRevealed] = useState(0);   // how many bubbles are currently shown

  // Fetch the 1H movers once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl('/api/crypto-gainers'));
        const d = await r.json();
        const rows = (d.rows || []).filter(x => x && Number.isFinite(x.p1h));
        rows.sort((a, b) => Math.abs(b.p1h) - Math.abs(a.p1h));   // biggest 1H movers first
        const built = rows.slice(0, 20).map((row, i) => ({
          sym: row.sym,
          pct: row.p1h,
          size: BUB_SIZES[i],
          baseOp: OP_CHOICES[Math.floor(Math.random() * OP_CHOICES.length)],  // 20/30/40% random
          x: 6 + Math.round(Math.random() * 80),   // % position across the whole panel
          y: 6 + Math.round(Math.random() * 78),
          dur: 9 + Math.round(Math.random() * 6),  // drift duration (s)
          delay: Math.round(Math.random() * 4),
          variant: i % 3,
        }));
        if (!cancelled) setBubbles(built);
      } catch { /* no preview if unreachable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Looping fade cycle: all visible (5s) → fade out ALL → reveal +1,+2,+1,+3,+rest (1s each) → repeat.
  useEffect(() => {
    if (!bubbles.length) return;
    let alive = true;
    const timers = [];
    const at = (fn, ms) => { const t = setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); };
    const steps = REVEAL_STEPS.map(n => Math.min(n, bubbles.length));

    const cycle = () => {
      at(() => {
        setRevealed(0);   // fade out all — they disappear completely
        steps.forEach((count, idx) => at(() => setRevealed(count), 1000 * (idx + 1)));   // staggered return
        at(cycle, 1000 * steps.length);   // next cycle once all are back
      }, 5000);           // hold all-visible for 5s
    };

    at(() => { setRevealed(bubbles.length); cycle(); }, 3000);   // initial appearance after 3s
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [bubbles.length]);

  if (!bubbles.length) return null;

  return (
    <div className="sw-bubbles-bg" aria-hidden="true">
      {bubbles.map((b, i) => {
        const up = b.pct >= 0;
        return (
          <div
            key={`${b.sym}-${i}`}
            className="sw-bub"
            style={{
              left: `${b.x}%`, top: `${b.y}%`,
              width: b.size, height: b.size,
              opacity: i < revealed ? b.baseOp : 0,   // staggered fade in/out; random brightness
              animation: `sw-bub-float-${b.variant} ${b.dur}s ease-in-out ${b.delay}s infinite`,
            }}
          >
            <span className="sw-bub-sym" style={{ fontSize: Math.max(8, b.size * 0.26) }}>{b.sym}</span>
            <span className="sw-bub-pct" style={{ fontSize: Math.max(6, b.size * 0.18) }}>
              {up ? '+' : ''}{b.pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

const LABELS = [
  'מתחבר למקורות נתונים',
  'מושך נרות ונפח מסחר',
  'מדרג מניות מובילות',
  'מנתח סיגנלים טכניים',
  'סורק שוק עולמי',
];

function useLoopProgress() {
  const [prog, setProg] = useState(5);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / CLIMB_MS, 1);
      const p = Math.max(5, Math.round(t * 89));
      setProg(p);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return prog;
}

export default function ScannerWidget({ onSearch }) {
  const prog     = useLoopProgress();
  const labelIdx = Math.floor((prog / 89) * (LABELS.length - 1));
  const label    = LABELS[Math.min(labelIdx, LABELS.length - 1)];

  // mode: 'anim' | 'bubbles' | 'search'
  const [mode,  setMode]  = useState('anim');
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  const handleSearch = () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    onSearch(sym);
    setMode('anim');
    setInput('');
  };

  return (
    <div className="sw-wrap">
      <style>{`
        @keyframes sw-spinCW  { to { transform: rotate(360deg);  } }
        @keyframes sw-spinCCW { to { transform: rotate(-360deg); } }
        @keyframes sw-orb     { 0%,100%{transform:scale(1)}50%{transform:scale(1.1)} }
        @keyframes sw-fadein  { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sw-bub-float-0 { 0%{transform:translate(0,0)} 50%{transform:translate(26px,-30px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-float-1 { 0%{transform:translate(0,0)} 50%{transform:translate(-30px,22px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-float-2 { 0%{transform:translate(0,0)} 50%{transform:translate(20px,28px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-pulse   { 0%,100%{opacity:0.2} 50%{opacity:0.5} }
      `}</style>

      {mode === 'anim' && (
        /* ══ ANIMATION MODE ══════════════════════════════════════ */
        <button className="sw-anim-btn" onClick={() => setMode('bubbles')} aria-label="פתח מפת בועות קריפטו">

          {/* Ambient 1H-crypto preview — behind the animation */}
          <ScannerBubblesBg />

          <div className="sw-top">
            <span className="sw-title">סריקת AI מתבצעת</span>
          </div>

          {/* Spinning rings + orb — 210×210 container */}
          <div className="sw-rings-area">
            <div className="sw-rings-container">
              <svg className="sw-svg" viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="swGA" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor="#071e45"/>
                    <stop offset="100%" stopColor="#1e90ff"/>
                  </linearGradient>
                  <linearGradient id="swGB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor="#1e90ff"/>
                    <stop offset="100%" stopColor="#0d47a1"/>
                  </linearGradient>
                </defs>

                {/* outer ring CW — 6.24s */}
                <g style={{transformOrigin:'105px 105px', animation:'sw-spinCW 6.24s linear infinite'}}>
                  <circle cx="105" cy="105" r="91" fill="none" stroke="url(#swGA)"
                    strokeWidth="3" strokeLinecap="round" strokeDasharray="160 412"/>
                </g>

                {/* mid ring CCW — 4.68s */}
                <g style={{transformOrigin:'105px 105px', animation:'sw-spinCCW 4.68s linear infinite'}}>
                  <circle cx="105" cy="105" r="70" fill="none" stroke="url(#swGB)"
                    strokeWidth="3" strokeLinecap="round" strokeDasharray="114 326"/>
                </g>

                {/* inner ring CW — 3.51s */}
                <g style={{transformOrigin:'105px 105px', animation:'sw-spinCW 3.51s linear infinite'}}>
                  <circle cx="105" cy="105" r="49" fill="none"
                    stroke="rgba(30,144,255,.5)" strokeWidth="2"
                    strokeLinecap="round" strokeDasharray="55 253"/>
                </g>
              </svg>

              {/* Glowing orb — perfectly centered */}
              <div className="sw-orb-wrap">
                <div className="sw-orb" style={{animation:'sw-orb 3s ease-in-out infinite'}}/>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="sw-bar-area">
            <div className="sw-bar-track">
              <div className="sw-bar-fill" style={{width:`${prog}%`, background: BAR_GRAD}}/>
            </div>
            <div className="sw-bar-meta">
              <span className="sw-bar-label">…{label}</span>
              <span className="sw-bar-pct">{prog}%</span>
            </div>
          </div>
        </button>
      )}

      {mode === 'bubbles' && (
        /* ══ BUBBLES MODE ════════════════════════════════════════ */
        <BubbleChart
          onManualSearch={() => setMode('search')}
          onClose={() => setMode('anim')}
        />
      )}

      {mode === 'search' && (
        /* ══ SEARCH MODE ══════════════════════════════════════════ */
        <div className="sw-search" style={{animation:'sw-fadein .25s ease'}}>
          <div className="sw-search-title">סריקת מניות חכמה</div>
          <p className="sw-search-sub">הסריקה היומית שלך — Scan of Today</p>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="הזינו שם חברה או סימול מניה (אופציונלי)"
            className="sw-search-input"
          />

          <button className="sw-search-btn" onClick={handleSearch}>
            ⚡ סריקה חדשה
          </button>

          <button className="sw-search-cancel" onClick={() => setMode('bubbles')}>
            ← חזרה לסריקה
          </button>
        </div>
      )}
    </div>
  );
}
