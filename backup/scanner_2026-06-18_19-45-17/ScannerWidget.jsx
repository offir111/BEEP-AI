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
const OP_CHOICES = [0.2, 0.3, 0.4];         // random per-bubble brightness (up to 40%)

// Entry keeps repeating the +1,+2,+1,+3 rhythm until all 20 are in (no "+rest" dump).
const UP_PATTERN = [1, 2, 1, 3];
const UP = (() => {
  const seq = []; let cur = 0, i = 0;
  while (cur < 20) { cur = Math.min(20, cur + UP_PATTERN[i % UP_PATTERN.length]); seq.push(cur); i++; }
  return seq;                                         // [1,3,4,7,8,10,11,14,15,17,18,20]
})();
const DOWN = [...UP.slice(0, -1)].reverse().concat(0); // fade-out = the entry reversed
// No gap at the end: the staggered fade-out overlaps the next staggered fade-in (3s fades),
// so as the last bubble leaves a new one is already entering → the panel is never empty.
const SCHEDULE = [...UP, 20, 20, 20, 20, 20, ...DOWN];

// The central blue orb is forbidden — bubbles approach to ~1cm but never sit under it.
function randPos(outer) {
  for (let k = 0; k < 50; k++) {
    const x = 4 + Math.random() * 86;                  // 4..90 %
    const y = 4 + Math.random() * 86;
    const dx = (x - 50) / 16, dy = (y - 47) / 20;      // orb exclusion ellipse
    const r = dx * dx + dy * dy;
    if (r < 1) continue;                               // under the orb → reject
    if (outer && r < 3.2) continue;                    // big-drift balls start in the outer area
    return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: Math.random() < 0.5 ? 8 : 90, y: 8 + Math.round(Math.random() * 82) };
}
const BIG_MOVE = new Set([4, 9, 14]);                  // 3 balls drift a longer, slow outer path

// Fresh random layout — used on first build AND each time a bubble re-enters, so a
// re-appearing bubble shows up in a different corner.
function freshLayout(idx) {
  const big = BIG_MOVE.has(idx);
  const pos = randPos(big);
  return {
    x: pos.x, y: pos.y,
    dur: big ? 18 + Math.round(Math.random() * 6) : 11 + Math.round(Math.random() * 5),
    delay: Math.round(Math.random() * 4),
    anim: big ? `sw-bub-big-${idx % 3}` : `sw-bub-float-${idx % 3}`,
  };
}

function ScannerBubblesBg() {
  const [bubbles, setBubbles]   = useState([]);
  const [revealed, setRevealed] = useState(0);   // how many bubbles are currently shown
  const [highlight, setHighlight] = useState(-1); // small ball whose aperture opens to ~80%

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
          fade: i === 0 ? 5 : 3,    // the first ball fades in slowly over 5s (no jump)
          ...freshLayout(i),
        }));
        if (!cancelled) setBubbles(built);
      } catch { /* no preview if unreachable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // One 1s-tick driver walks the SCHEDULE forever: staggered in → hold → staggered out → loop.
  // Initial entry (after 3s) is the SAME staggered fade-in, not all-at-once.
  useEffect(() => {
    if (!bubbles.length) return;
    const sched = SCHEDULE.map(v => Math.min(v, bubbles.length));
    let tick = -1, iv, prev = 0;
    const startT = setTimeout(() => {
      const advance = () => {
        tick = (tick + 1) % sched.length;
        const next = sched[tick];
        if (next > prev) {
          // Re-entering bubbles get a fresh position ("a new bubble in a different corner").
          // BUT the low-index balls (0–3) stay continuously visible across the wrap, so moving
          // them would cause a jump — keep their position fixed; only re-roll 4+ (fully faded).
          setBubbles(bs => bs.map((b, idx) => (idx >= 4 && idx >= prev && idx < next) ? { ...b, ...freshLayout(idx) } : b));
        }
        prev = next;
        setRevealed(next);
      };
      advance();                          // first reveal (1 bubble)
      iv = setInterval(advance, 1000);    // then one step per second
    }, 3000);                             // initial delay after entering the app
    return () => { clearTimeout(startT); if (iv) clearInterval(iv); };
  }, [bubbles.length]);

  // Roving spotlight: one small ball at a time opens its aperture up to ~80%, then the next
  // (one finishes as the next begins), cycling through the small bubbles.
  useEffect(() => {
    if (bubbles.length < 6) return;
    const smalls = bubbles.map((_, i) => i).filter(i => i >= 4);   // the small balls
    let k = 0, iv;
    const t = setTimeout(() => {
      const step = () => { setHighlight(smalls[k % smalls.length]); k += 1; };
      step();
      iv = setInterval(step, 4000);   // ~3s fade up to 80% + brief hold, then pass to the next
    }, 5000);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
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
              opacity: i < revealed ? (i === highlight ? 0.8 : b.baseOp) : 0,   // staggered; spotlight → 80%
              transition: `opacity ${b.fade}s ease`,   // first ball = 5s, rest = 3s
              animation: `${b.anim} ${b.dur}s ease-in-out ${b.delay}s infinite`,
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
        @keyframes sw-bub-float-0 { 0%{transform:translate(0,0)} 50%{transform:translate(38px,-44px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-float-1 { 0%{transform:translate(0,0)} 50%{transform:translate(-44px,32px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-float-2 { 0%{transform:translate(0,0)} 50%{transform:translate(30px,40px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-big-0   { 0%{transform:translate(0,0)} 50%{transform:translate(88px,-66px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-big-1   { 0%{transform:translate(0,0)} 50%{transform:translate(-80px,74px)} 100%{transform:translate(0,0)} }
        @keyframes sw-bub-big-2   { 0%{transform:translate(0,0)} 50%{transform:translate(64px,88px)} 100%{transform:translate(0,0)} }
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
