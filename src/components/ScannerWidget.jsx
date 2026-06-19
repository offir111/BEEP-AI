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
// 28 small bubbles. Largest = 44px ≈ 31% smaller than the 64px central orb (no big bubbles).
// The last 8 (idx ≥ 20) spawn on the side edges → extra distant beam targets.
const TOTAL = 28;
const BUB_SIZES = [
  44, 40, 34, 32,
  28, 26, 24, 24, 22, 22, 20, 26, 22, 24, 20, 28, 22, 24, 20, 26,
  20, 22, 18, 20, 22, 18, 20, 22,            // +8 small side targets
];
const OP_CHOICES = [0.2, 0.3, 0.4];         // random per-bubble brightness (up to 40%)

// Entry keeps repeating the +1,+2,+1,+3 rhythm until all are in (no "+rest" dump).
const UP_PATTERN = [1, 2, 1, 3];
const UP = (() => {
  const seq = []; let cur = 0, i = 0;
  while (cur < TOTAL) { cur = Math.min(TOTAL, cur + UP_PATTERN[i % UP_PATTERN.length]); seq.push(cur); i++; }
  return seq;
})();
const DOWN = [...UP.slice(0, -1)].reverse().concat(0); // fade-out = the entry reversed
// No gap at the end: the staggered fade-out overlaps the next staggered fade-in (3s fades),
// so as the last bubble leaves a new one is already entering → the panel is never empty.
const SCHEDULE = [...UP, TOTAL, TOTAL, TOTAL, TOTAL, TOTAL, ...DOWN];

// The central blue orb is forbidden — bubbles approach to ~1cm but never sit under it.
function randPos(outer) {
  for (let k = 0; k < 60; k++) {
    // Polar, biased outward → fills the edges AND the corners (incl. the top corners).
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.5 + Math.random() * 0.5;             // 0.5..1.0 of the half-extent → outer band
    const x = 50 + Math.cos(ang) * rad * 48;
    const y = 47 + Math.sin(ang) * rad * 47;
    if (x < 3 || x > 95 || y < 3 || y > 95) continue;  // keep inside the panel
    const dx = (x - 50) / 16, dy = (y - 47) / 20;      // orb exclusion ellipse
    const r = dx * dx + dy * dy;
    if (r < 1) continue;                               // under the orb → reject
    if (outer && r < 3.2) continue;                    // big-drift balls even farther out
    return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: Math.random() < 0.5 ? 8 : 90, y: Math.random() < 0.5 ? 10 : 86 };
}
const BIG_MOVE = new Set([4, 9, 14]);                  // 3 balls drift a longer, slow outer path

// The 8 extra bubbles (idx ≥ 20) spawn on the LEFT/RIGHT edges → distant beam targets.
function sidePos() {
  const left = Math.random() < 0.5;
  return {
    x: left ? 5 + Math.round(Math.random() * 11) : 84 + Math.round(Math.random() * 11),
    y: 8 + Math.round(Math.random() * 80),
  };
}

// Fresh random layout — used on first build AND each time a bubble re-enters, so a
// re-appearing bubble shows up in a different corner.
function freshLayout(idx) {
  const big = BIG_MOVE.has(idx);
  const pos = idx >= 20 ? sidePos() : randPos(big);
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
        const built = rows.slice(0, TOTAL).map((row, i) => ({
          sym: row.sym,
          pct: row.p1h,
          size: BUB_SIZES[i],
          baseOp: OP_CHOICES[Math.floor(Math.random() * OP_CHOICES.length)],  // 20/30/40% random
          fade: i === 0 ? 1.8 : 3,  // first ball fades in fast (~1.8s, no jump)
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
    }, 600);                              // first bubble appears fast after entering the app
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

// ════════════════════════════════════════════════════════════════════════════
//  Scanner beam — a lighthouse cone of light from the central orb that lights up
//  one small stock bubble at a time. Pure overlay canvas (no React re-render per
//  frame, rAF-driven, paused when the tab is hidden). Reads live DOM positions of
//  .sw-orb and .sw-bub so it tracks the drifting bubbles.
// ════════════════════════════════════════════════════════════════════════════

// ── 3 easy-to-tune knobs ──────────────────────────────────────────────────────
const BEAM_COLOR  = ['#6EC6FF', '#BFE9FF'];  // cone gradient: source → tip
const ILLUM_MS    = 3000;                     // how long a bubble stays lit
const CYCLE_MS    = 10000;                    // full lighthouse cycle (two sweeps + rest)
// ──────────────────────────────────────────────────────────────────────────────
const FADE_MS = 400;   // cone fade in/out
const GAP_MS  = 1000;  // pause between the two sweeps
const WIN_MS  = FADE_MS + ILLUM_MS + FADE_MS;   // one sweep window (3.8s)

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const easeIn = x => x * x;
function envelope(t) {                          // 0→1→0 over a sweep window
  if (t < 0 || t > WIN_MS) return 0;
  if (t < FADE_MS) return easeIn(t / FADE_MS);
  if (t < FADE_MS + ILLUM_MS) return 1;
  return 1 - easeIn((t - FADE_MS - ILLUM_MS) / FADE_MS);
}

// Half-width of the cone at fraction s along its axis (narrow at orb → wide at tip).
const coneHalf = (s, tipR) => 5 + (Math.max(tipR * 1.25, 16) - 5) * s;

// Is the straight path orb→target clear of every other bubble?
function pathClear(o, t, others) {
  const dx = t.x - o.x, dy = t.y - o.y;
  const len2 = dx * dx + dy * dy || 1;
  for (const b of others) {
    const s = ((b.x - o.x) * dx + (b.y - o.y) * dy) / len2;
    if (s <= 0.02 || s >= 1) continue;
    const px = o.x + s * dx, py = o.y + s * dy;
    const dist = Math.hypot(b.x - px, b.y - py);
    if (dist < b.r + coneHalf(s, t.r)) return false;
  }
  return true;
}

function ScannerBeamCanvas({ panelRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!canvas || !panel) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0, running = true;
    // "Precise stock-search" state machine. It PROBES: lights up one bubble ~1s and closes,
    // hops to a neighbour / the opposite side / a third — quick taps (~3s cadence) that read as
    // hunting for the right stock. After ~8–11s of probing it FOCUSES one bubble (rings gather +
    // pull-wave) and SUCKS it in. A full capture lands on average ~every 15s.
    // phases: probe → probeGap → … → focus → collect → (loop).
    let phase = 'probe', phaseT0 = performance.now();
    let target = null, k = 0, prevNow = performance.now();
    let cycleStart = performance.now(), probeWindow = 6000 + Math.random() * 3000;
    let lastRef = null;
    // A probe "event" lights 1/2/3 bubbles. deltas = angle (deg) of each jump from the previous
    // bubble around the orb (null = free pick). The pattern + timings are re-rolled each event.
    let probeDeltas = [null], probeStep = 0;
    let probeIn = 250, probeLit = 1000, probeOut = 250, probeJump = 0;
    const startProbeEvent = () => {
      const roll = Math.random();
      if (roll < 0.5)      { probeDeltas = [null];                                      probeIn = 250; probeLit = 1000; probeOut = 250; probeJump = 0; }   // single, ~1s
      else if (roll < 0.8) { probeDeltas = [null, Math.random() < 0.5 ? 90 : -90];      probeIn = 140; probeLit = 540;  probeOut = 140; probeJump = 110; }  // double: jump 90°
      else                 { probeDeltas = [null, Math.random() < 0.5 ? -45 : 45, 180]; probeIn = 110; probeLit = 430;  probeOut = 110; probeJump = 90; }   // triple: 45° then 180°, ~2s
      probeStep = 0;
    };
    startProbeEvent();
    let collectFrom = null, collectedEl = null;   // the bubble being sucked into the orb
    let orbOpenUntil = 0, orbFadeUntil = 0;        // orb inner "window" visible until / fading until ts

    // Frosted grain tile for the orb's inner window — the core reads as blurred grainy WHITE (not black).
    const grain = document.createElement('canvas');
    grain.width = grain.height = 72;
    {
      const gx = grain.getContext('2d');
      const img = gx.createImageData(72, 72);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 150 + Math.floor(Math.random() * 105);   // light grey → white speckle
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      gx.putImageData(img, 0, 0);
    }

    const sizeCanvas = () => {
      const r = panel.getBoundingClientRect();
      canvas.width  = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width  = r.width + 'px';
      canvas.style.height = r.height + 'px';
    };
    sizeCanvas();
    const ro = new ResizeObserver(sizeCanvas);
    ro.observe(panel);

    const local = (rect, pr) => ({
      x: rect.left - pr.left + rect.width / 2,
      y: rect.top - pr.top + rect.height / 2,
      r: rect.width / 2,
    });

    const readBubbles = (pr) => {
      const out = [];
      panel.querySelectorAll('.sw-bub').forEach(el => {
        const op = parseFloat(el.style.opacity || '0') || 0;
        if (op < 0.12) return;                  // skip hidden/fading bubbles
        const b = local(el.getBoundingClientRect(), pr);
        b.el = el;
        out.push(b);
      });
      return out;
    };

    // Pick a FAR small bubble on a side — NO clear-path pre-filter, so it deliberately
    // attempts risky far targets; the per-frame block check handles the instant re-fire.
    const farSmall = (bubbles, orb, side, w) => {
      const cx = w / 2;
      const arr = bubbles.filter(b => (side === 'left' ? b.x < cx - 6 : b.x > cx + 6));
      if (!arr.length) return null;
      arr.sort((a, b) => Math.hypot(b.x - orb.x, b.y - orb.y) - Math.hypot(a.x - orb.x, a.y - orb.y));
      const far = arr.slice(0, Math.max(1, Math.ceil(arr.length * 0.6)));   // farthest 60%
      return far[Math.floor(Math.random() * far.length)].el;
    };

    // Probe picker — quick search taps. mode: 'neighbour' (near the last tap), 'opposite' (other
    // side of the orb), or 'random' (any far-ish bubble). Returns a bubble element.
    const pickProbe = (bubbles, orb, ref, mode) => {
      if (!bubbles.length) return null;
      let pool = bubbles;
      if (mode === 'neighbour' && ref) {
        pool = bubbles.slice().sort((a, b) =>
          Math.hypot(a.x - ref.x, a.y - ref.y) - Math.hypot(b.x - ref.x, b.y - ref.y))
          .slice(1, 5);                                  // a few closest to the last tap (skip itself)
      } else if (mode === 'opposite' && ref) {
        const refLeft = ref.x < orb.x;
        pool = bubbles.filter(b => (refLeft ? b.x > orb.x : b.x < orb.x));
      }
      if (!pool.length) pool = bubbles;
      return pool[Math.floor(Math.random() * pool.length)].el;
    };

    // Angle picker — within a multi-bubble pattern, jump to the bubble whose angle around the orb
    // is closest to (previous bubble's angle + deltaDeg). Used for the 45°/90°/180° hops.
    const pickByAngle = (bubbles, orb, fromPos, deltaDeg) => {
      if (!bubbles.length || !fromPos) return null;
      const want = Math.atan2(fromPos.y - orb.y, fromPos.x - orb.x) + (deltaDeg * Math.PI) / 180;
      let best = null, bestD = Infinity;
      for (const b of bubbles) {
        if (Math.hypot(b.x - fromPos.x, b.y - fromPos.y) < 6) continue;     // skip the same bubble
        const ang = Math.atan2(b.y - orb.y, b.x - orb.x);
        const d = Math.abs(((ang - want + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        if (d < bestD) { bestD = d; best = b; }
      }
      return best ? best.el : null;
    };

    // Focus picker — the bubble it commits to and sucks; prefer a clear, far-ish path.
    const pickFocus = (bubbles, orb) => {
      if (!bubbles.length) return null;
      const far = bubbles.slice().sort((a, b) =>
        Math.hypot(b.x - orb.x, b.y - orb.y) - Math.hypot(a.x - orb.x, a.y - orb.y));
      const clear = far.filter(b => pathClear(orb, b, bubbles.filter(x => x.el !== b.el)));
      const src = clear.length ? clear : far;
      const pool = src.slice(0, Math.max(1, Math.ceil(src.length * 0.6)));
      return pool[Math.floor(Math.random() * pool.length)].el;
    };

    function drawBeam(o, t, k) {
      const dx = t.x - o.x, dy = t.y - o.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, px = -uy, py = ux;
      const sH = 5, eH = Math.max(t.r * 1.25, 16);
      const sx = o.x + ux * o.r * 0.65, sy = o.y + uy * o.r * 0.65;  // emanate from orb edge
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(5px)';
      const g = ctx.createLinearGradient(sx, sy, t.x, t.y);
      g.addColorStop(0, rgba(BEAM_COLOR[0], 0.42 * k));
      g.addColorStop(1, rgba(BEAM_COLOR[1], 0.10 * k));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx + px * sH, sy + py * sH);
      ctx.lineTo(sx - px * sH, sy - py * sH);
      ctx.lineTo(t.x - px * eH, t.y - py * eH);
      ctx.lineTo(t.x + px * eH, t.y + py * eH);
      ctx.closePath();
      ctx.fill();
      // brighter narrow core
      ctx.filter = 'blur(2px)';
      const g2 = ctx.createLinearGradient(sx, sy, t.x, t.y);
      g2.addColorStop(0, rgba(BEAM_COLOR[1], 0.5 * k));
      g2.addColorStop(1, rgba(BEAM_COLOR[1], 0));
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(sx + px * sH * 0.6, sy + py * sH * 0.6);
      ctx.lineTo(sx - px * sH * 0.6, sy - py * sH * 0.6);
      ctx.lineTo(t.x - px * eH * 0.5, t.y - py * eH * 0.5);
      ctx.lineTo(t.x + px * eH * 0.5, t.y + py * eH * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawGlow(t, k, now) {
      const R = t.r * (1 + 0.03 * Math.sin(now / 350));   // ±3% breathing
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 3) outer glow
      ctx.filter = 'blur(8px)';
      let g = ctx.createRadialGradient(t.x, t.y, R * 0.4, t.x, t.y, R * 1.9);
      g.addColorStop(0, rgba('#6EC6FF', 0.32 * k));
      g.addColorStop(1, rgba('#6EC6FF', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y, R * 1.9, 0, Math.PI * 2); ctx.fill();
      // 1) inner core
      ctx.filter = 'blur(1px)';
      g = ctx.createRadialGradient(t.x - R * 0.22, t.y - R * 0.22, R * 0.1, t.x, t.y, R);
      g.addColorStop(0,   rgba('#EAF7FF', 0.85 * k));
      g.addColorStop(0.5, rgba('#7FD4FF', 0.55 * k));
      g.addColorStop(1,   rgba('#3BA8E0', 0.28 * k));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y, R, 0, Math.PI * 2); ctx.fill();
      // warm gold reflex at the bottom (~15%)
      ctx.filter = 'blur(2px)';
      g = ctx.createRadialGradient(t.x, t.y + R * 0.45, 0, t.x, t.y + R * 0.45, R * 0.85);
      g.addColorStop(0, rgba('#FFD27A', 0.15 * k));
      g.addColorStop(1, rgba('#FFD27A', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y + R * 0.4, R * 0.85, 0, Math.PI * 2); ctx.fill();
      // 2) rim light / halo
      ctx.filter = 'blur(1.5px)';
      ctx.strokeStyle = rgba('#9FE3FF', 0.8 * k);
      ctx.lineWidth = Math.max(1.5, R * 0.08);
      ctx.beginPath(); ctx.arc(t.x, t.y, R * 0.98, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    const PROBE_GAP = 1100;                                                      // dark pause between probe events
    const FOCUS_MS = 2500;                                                       // final lock: rings gather, then suck
    const REST_AFTER_MS = 3000;                                                  // after a capture: rings just spin ~3s, no beams
    const SHAKE_MS = 500, PAUSE_MS = 1000, SUCK_MS = 2000, IMPACT_MS = 350;  // collect: shake 0.5s → tense pause 1s → suck
    const ANTIC = SHAKE_MS + PAUSE_MS;                          // anticipation before the suck (1.5s)
    const SLAM_MS = 500, ORB_OPEN_MS = 500;                     // bubble slams inner wall; orb window ~0.5s then back to normal

    // Orb reaction when a collected bubble enters it — a SOFT, contained flash kept INSIDE the orb
    // (no burst beyond it) so the orb stays normal and the semi-transparent centre filters it blue.
    function drawOrbFlash(o, s) {                                // s: 0→1
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(3px)';
      const R = o.r * (0.5 + s * 0.4);                          // stays within the orb radius
      ctx.strokeStyle = rgba('#BFE9FF', 0.3 * (1 - s));
      ctx.lineWidth = Math.max(1.5, o.r * 0.12 * (1 - s));
      ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.stroke();
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 0.78);
      g.addColorStop(0, rgba('#EAF7FF', 0.3 * (1 - s)));
      g.addColorStop(1, rgba('#6EC6FF', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // The 3 curved rings gather on the FAR side of the orb (opposite the beam) and pulse a
    // "pull" wave: the outer (largest) ring bulges out then back; the bulge travels inward,
    // ring to ring, and finishes its run toward the beam exactly as the bubble is sucked in.
    // beamAng = orb→bubble; gather 0→1 = how fully pulled to the far side; wave 0→1 = pulse travel.
    const RING_HEX = ['#1e90ff', '#6EC6FF', '#90caf9'];   // outer, mid, inner
    function drawGatherRings(o, beamAng, gather, wave) {
      const far = beamAng + Math.PI;                      // opposite the beam
      const scale = Math.max(0.6, o.r / 32);              // responsive to the orb's on-screen size
      const radii = [91, 70, 49].map(r => r * scale);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(1.4px)';
      radii.forEach((rad, i) => {
        const slot  = i / 3;                              // outer pulses first, inner last
        const local = Math.max(0, 1 - Math.abs(wave - slot) / 0.30);
        const pulse = Math.sin(local * Math.PI);          // smooth bulge 0→1→0
        const r     = rad + pulse * 11 * scale * gather;  // bulge outward as the pull fires
        const half  = (1.15 - 0.55 * gather);             // arc concentrates (shrinks) as it gathers
        const alpha = (0.22 + 0.62 * pulse) * gather;
        ctx.strokeStyle = rgba(RING_HEX[i], alpha);
        ctx.lineWidth   = (3 - i * 0.4) * scale * (1 + pulse * 0.9);
        ctx.beginPath();
        ctx.arc(o.x, o.y, r, far - half, far + half);
        ctx.stroke();
      });
      ctx.restore();
    }

    // The captured bubble flies in from the beam side and slams the FAR inner wall (in its
    // direction of travel), flattening against it with a ripple. Visible through the orb window.
    function drawBubbleImpact(o, beamAng, hit) {           // hit: 0→1
      const wallA  = beamAng + Math.PI;                    // far inner wall it hits
      const innerR = o.r * 0.6;
      const k      = Math.sin(Math.min(1, hit) * Math.PI); // squash 0→1→0
      const cx = o.x + Math.cos(wallA) * innerR * (0.35 + 0.55 * hit);
      const cy = o.y + Math.sin(wallA) * innerR * (0.35 + 0.55 * hit);
      const rr = o.r * (0.34 * (1 - 0.35 * hit));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(1.4px)';
      ctx.translate(cx, cy); ctx.rotate(wallA);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 1.4);
      g.addColorStop(0,   rgba('#EAF7FF', 0.92));
      g.addColorStop(0.5, rgba('#6EC6FF', 0.6));
      g.addColorStop(1,   rgba('#1e90ff', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr * (1 - 0.32 * k), rr * (1 + 0.32 * k), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // impact ripple along the inner wall
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(2px)';
      ctx.strokeStyle = rgba('#BFE9FF', 0.5 * (1 - hit));
      ctx.lineWidth = Math.max(1.5, o.r * 0.12 * (1 - hit));
      ctx.beginPath(); ctx.arc(cx, cy, o.r * (0.28 + 0.5 * hit), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // The orb's inner core while a bubble is inside — a soft blurred grainy WHITE flash. It's drawn
    // BEHIND the orb, which is now only ~30% transparent → the orb tints it blue (no tint drawn here).
    function drawOrbInner(o, a) {                       // a: 0→1 visibility
      const R = o.r * 0.62;
      ctx.save();
      ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.clip();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'blur(2.5px)';
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
      g.addColorStop(0,   `rgba(246,251,255,${0.85 * a})`);
      g.addColorStop(0.7, `rgba(212,229,246,${0.7 * a})`);
      g.addColorStop(1,   `rgba(182,206,231,${0.45 * a})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.26 * a;                       // grain speckle over the milk
      ctx.filter = 'blur(0.7px)';
      ctx.drawImage(grain, o.x - R, o.y - R, R * 2, R * 2);
      ctx.restore();
    }

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(now - prevNow, 50); prevNow = now;

      const pr = panel.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, pr.width, pr.height);
      const orbEl = panel.querySelector('.sw-orb');
      if (!orbEl || pr.width === 0) return;
      const orb = local(orbEl.getBoundingClientRect(), pr);
      const bubbles = readBubbles(pr);
      const svgEl = panel.querySelector('.sw-svg');
      const wavePhase = (now / 3200) % 1;     // SLOW outer→inner→beam energy pulse (deliberate, not fast)

      // Orb inner window: the fast slam holds ~0.5s, then the white flash fades out over 3s while
      // the CSS orb centre fades back to solid opaque blue in sync → natural motion, no jump.
      if (orbOpenUntil && now >= orbOpenUntil) {
        try { orbEl.classList.remove('sw-orb--open'); } catch { /* noop */ }
        orbOpenUntil = 0; orbFadeUntil = now + 3000;
      }
      if (orbOpenUntil) drawOrbInner(orb, 1);
      else if (orbFadeUntil && now < orbFadeUntil) drawOrbInner(orb, (orbFadeUntil - now) / 3000);

      // The beam waits until at least 6 bubbles exist before it ever fires.
      if (bubbles.length < 6) { k = 0; target = null; phaseT0 = now; return; }

      if (phase === 'probe') {
        // One illumination of the current step. Single events = 1 bubble (~1s); double = jump 90°
        // to a 2nd; triple = jump 45° then 180° to a 3rd (~2s) — fast, snappy hops. Rings stay normal.
        if (svgEl) svgEl.classList.remove('sw-rings--dim');
        if (!target || !target.isConnected) {
          target = (probeStep === 0)
            ? pickProbe(bubbles, orb, lastRef, 'random')
            : (pickByAngle(bubbles, orb, lastRef, probeDeltas[probeStep]) || pickProbe(bubbles, orb, lastRef, 'random'));
          phaseT0 = now; k = 0;
        }
        if (!target) { phase = 'probeGap'; phaseT0 = now; k = 0; }
        else {
          const e = now - phaseT0;
          const dur = probeIn + probeLit + probeOut;
          if (e < probeIn) k = e / probeIn;
          else if (e < probeIn + probeLit) k = 1;
          else k = Math.max(0, 1 - (e - probeIn - probeLit) / probeOut);
          const tg = local(target.getBoundingClientRect(), pr);
          drawBeam(orb, tg, k); drawGlow(tg, k, now);
          if (e >= dur) {
            lastRef = { x: tg.x, y: tg.y }; target = null; k = 0;
            probeStep += 1;
            if (probeStep < probeDeltas.length) { phase = 'probeJump'; phaseT0 = now; }   // hop to next bubble
            else { phase = 'probeGap'; phaseT0 = now; }                                    // pattern done
          }
        }
      } else if (phase === 'probeJump') {
        // Tiny dark hop between the bubbles inside one multi-illumination pattern.
        if (now - phaseT0 >= probeJump) { phase = 'probe'; phaseT0 = now; }
      } else if (phase === 'probeGap') {
        // Dark pause between probe events. When the probing window is up → commit to a focus + suck;
        // otherwise re-roll the next pattern (single / double / triple) and keep hunting.
        if (now - phaseT0 >= PROBE_GAP) {
          if (now - cycleStart >= probeWindow) {
            target = pickFocus(bubbles, orb);
            phase = target ? 'focus' : 'probe'; phaseT0 = now; k = 0;
            if (!target) startProbeEvent();
          } else {
            startProbeEvent(); target = null; phase = 'probe'; phaseT0 = now;
          }
        }
      } else if (phase === 'focus') {
        // Final lock — the chosen bubble. The spinning rings VANISH and the gathered rings take
        // over, SLOWLY transmitting the pull-wave behind the orb (~2.5s), then it'll be sucked.
        if (!target || !target.isConnected) target = pickFocus(bubbles, orb);
        if (!target) { phase = 'probe'; phaseT0 = now; startProbeEvent(); cycleStart = now; probeWindow = 6000 + Math.random() * 3000; }
        else {
          const e = now - phaseT0;
          if (svgEl) svgEl.classList.add('sw-rings--dim');
          const tg = local(target.getBoundingClientRect(), pr);
          const ba = Math.atan2(tg.y - orb.y, tg.x - orb.x);
          drawBeam(orb, tg, 1); drawGlow(tg, 1, now);
          drawGatherRings(orb, ba, Math.min(1, e / 700), wavePhase);
          if (e >= FOCUS_MS) {
            collectFrom = local(target.getBoundingClientRect(), pr);
            collectedEl = target;
            try { target.classList.add('sw-bub--collected'); } catch { /* noop */ }
            phase = 'collect'; phaseT0 = now;
          }
        }
      } else if (phase === 'collect') {
        const e = now - phaseT0;
        const lerp = (a, b, t) => a + (b - a) * t;
        if (!collectFrom) { phase = 'probe'; phaseT0 = now; startProbeEvent(); cycleStart = now; probeWindow = 6000 + Math.random() * 3000; }
        else {
          // beam side stays fixed at the bubble's source; rings (already gathered from the search
          // lock) keep transmitting the pull-wave on the far side until the bubble is sucked in.
          const beamAng = Math.atan2(collectFrom.y - orb.y, collectFrom.x - orb.x);
          const total   = ANTIC + SUCK_MS;

          if (e < ANTIC) {
            // shake 0.5s → tense pause 1s (held like a drawn bowstring), then it'll be sucked.
            if (svgEl) svgEl.classList.add('sw-rings--dim');
            let p;
            if (e < SHAKE_MS) {
              const amp = 1 + 3 * (e / SHAKE_MS);
              p = {
                x: collectFrom.x + Math.sin(now / 19) * amp + (Math.random() - 0.5) * 1.4,
                y: collectFrom.y + Math.cos(now / 16) * amp + (Math.random() - 0.5) * 1.4,
                r: collectFrom.r,
              };
            } else {
              p = { x: collectFrom.x, y: collectFrom.y, r: collectFrom.r };   // tense, dead-still pause
            }
            drawBeam(orb, p, 1); drawGlow(p, 1, now);
            drawGatherRings(orb, beamAng, 1, wavePhase);
          } else if (e < total) {
            // sucked along the beam into the orb — accelerating, shrinking, gentle inward curve;
            // the pull-wave keeps rippling through the gathered rings toward the beam.
            const s = (e - ANTIC) / SUCK_MS, es = s * s;
            const dxp = orb.x - collectFrom.x, dyp = orb.y - collectFrom.y;
            const len = Math.hypot(dxp, dyp) || 1;
            const curve = Math.sin(es * Math.PI) * Math.min(len * 0.12, 18);
            const p = {
              x: lerp(collectFrom.x, orb.x, es) + (-dyp / len) * curve,
              y: lerp(collectFrom.y, orb.y, es) + (dxp / len) * curve,
              r: collectFrom.r * (1 - es * 0.9),
            };
            drawBeam(orb, p, 1); drawGlow(p, Math.max(0.25, 1 - es * 0.25), now);
            drawGatherRings(orb, beamAng, 1, wavePhase);
          } else if (e < total + SLAM_MS) {
            // the bubble enters: orb inner part shows its blurred grainy-white core, the bubble
            // slams the inner wall; rings return to normal the instant it's sucked in.
            if (svgEl) svgEl.classList.remove('sw-rings--dim');
            if (!orbEl.classList.contains('sw-orb--open')) {
              try { orbEl.classList.add('sw-orb--open'); } catch { /* noop */ }
              orbOpenUntil = now + ORB_OPEN_MS;          // ...then ~0.5s later it fades back to solid blue
            }
            const hit = (e - total) / SLAM_MS;
            drawOrbFlash(orb, Math.min(1, hit / (IMPACT_MS / SLAM_MS)));
            drawBubbleImpact(orb, beamAng, hit);
          } else {
            // captured → rest: rings spin quietly with NO beam for ~3s before searching again.
            if (collectedEl) { try { collectedEl.classList.remove('sw-bub--collected'); } catch { /* noop */ } }
            collectedEl = null; collectFrom = null;
            phase = 'rest'; phaseT0 = now; target = null; k = 0;
          }
        }
      } else if (phase === 'rest') {
        // The bubble is now inside the orb. Let the rings just spin (no beams) ~3s; then it
        // re-organises and starts hunting the next stock with the illuminating beam.
        if (svgEl) svgEl.classList.remove('sw-rings--dim');
        if (now - phaseT0 >= REST_AFTER_MS) {
          phase = 'probe'; phaseT0 = now; target = null; k = 0;
          lastRef = null; startProbeEvent();
          cycleStart = now; probeWindow = 6000 + Math.random() * 3000;
        }
      }
    };

    const onVis = () => {
      if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf); }
      else if (!running) {
        running = true; prevNow = performance.now(); phaseT0 = performance.now();
        if (collectedEl) { try { collectedEl.classList.remove('sw-bub--collected'); } catch { /* noop */ } collectedEl = null; collectFrom = null; }
        try { panel.querySelector('.sw-svg')?.classList.remove('sw-rings--dim'); } catch { /* noop */ }
        try { panel.querySelector('.sw-orb')?.classList.remove('sw-orb--open'); } catch { /* noop */ }
        orbOpenUntil = 0; orbFadeUntil = 0;
        phase = 'probe'; target = null; k = 0;
        lastRef = null; startProbeEvent();
        cycleStart = performance.now(); probeWindow = 6000 + Math.random() * 3000;
        loop();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    loop();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      panel.querySelectorAll('.sw-bub--collected').forEach(el => el.classList.remove('sw-bub--collected'));
      try { panel.querySelector('.sw-svg')?.classList.remove('sw-rings--dim'); } catch { /* noop */ }
      try { panel.querySelector('.sw-orb')?.classList.remove('sw-orb--open'); } catch { /* noop */ }
    };
  }, [panelRef]);

  return <canvas ref={canvasRef} className="sw-beam-canvas" aria-hidden="true" />;
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
  const panelRef = useRef(null);   // scanner panel — anchor for the beam canvas

  // Once the bar reaches 89%, fade it (+ the "סורק שוק עולמי" label) out after 2s so it
  // doesn't cover the bubble/beam animation. Replays on every page load/refresh (fresh mount).
  const [barFaded, setBarFaded] = useState(false);
  useEffect(() => {
    if (prog < 89) return;
    const t = setTimeout(() => setBarFaded(true), 2000);
    return () => clearTimeout(t);
  }, [prog]);

  // Title "סריקת AI מתבצעת": fully shown during the scan; once the bar fades it disappears,
  // then blinks back for 2s every 10s. Resets on every page load/refresh (fresh mount).
  const [titleOn, setTitleOn] = useState(true);
  useEffect(() => {
    if (!barFaded) { setTitleOn(true); return; }
    setTitleOn(false);                                   // disappears with the bar
    let hideT;
    const iv = setInterval(() => {                       // every 10s → show for 2s
      setTitleOn(true);
      hideT = setTimeout(() => setTitleOn(false), 2000);
    }, 10000);
    return () => { clearInterval(iv); clearTimeout(hideT); };
  }, [barFaded]);

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
        <button className="sw-anim-btn" ref={panelRef} onClick={() => setMode('bubbles')} aria-label="פתח מפת בועות קריפטו">

          {/* Ambient 1H-crypto preview — behind the animation */}
          <ScannerBubblesBg />

          {/* Lighthouse scanner beam — lights up one bubble at a time (overlay, behind the orb) */}
          <ScannerBeamCanvas panelRef={panelRef} />

          <div className="sw-top">
            <span className={`sw-title${titleOn ? '' : ' sw-title--hidden'}`}>סריקת AI מתבצעת</span>
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
          <div className={`sw-bar-area${barFaded ? ' sw-bar-area--faded' : ''}`}>
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
