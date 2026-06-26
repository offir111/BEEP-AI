/**
 * HeatmapCanvas — the Bookmap-style chart surface. One <canvas>, one rAF loop.
 *
 * Layers (bottom → top):
 *   1. Liquidity heatmap — an offscreen buffer that scrolls left; each column is
 *      a real order-book depth snapshot (HeatmapEngine). Scroll-blit keeps it
 *      cheap (only the newest column is rasterised each cadence tick).
 *   2. BBO ribbon, Volume bubbles, Iceberg/Stop markers, current-price line.
 *   3. Price axis labels.
 *
 * Everything drawn is real Binance data fed through the engines. When the book
 * is stale/empty nothing is invented — the heatmap simply stops advancing and
 * the parent shows the 🔴 indicator.
 */
import { useRef, useEffect } from 'react';
import { drawBubbles } from './VolumeBubblesLayer';
import { drawBBO } from './BBORibbon';
import { drawAxes } from './TimePriceAxes';

// intensity 0..1 → blue → cyan → green → yellow → red
function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.25)      { const u = t / 0.25;        r = 10;            g = 20 + u * 80;   b = 90 + u * 120; }
  else if (t < 0.5)  { const u = (t - 0.25) / 0.25; r = 10;          g = 100 + u * 130; b = 210 - u * 160; }
  else if (t < 0.75) { const u = (t - 0.5) / 0.25;  r = 10 + u * 230; g = 230;          b = 50 - u * 50; }
  else               { const u = (t - 0.75) / 0.25; r = 240;         g = 230 - u * 200; b = 0; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export default function HeatmapCanvas({
  engines, getBook, getNow, running = true,
  toggles, columnIntervalMs = 150,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const offRef = useRef(null);        // offscreen scroll buffer
  const dimsRef = useRef({ W: 0, H: 0, dpr: 1 });
  const genRef = useRef(-1);
  const rafRef = useRef(0);
  const colTimerRef = useRef(0);

  // ── Size to container (and on resize) ──
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(50, Math.floor(rect.width));
      const H = Math.max(50, Math.floor(rect.height));
      dimsRef.current = { W, H, dpr };
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      // (Re)build offscreen buffer at device pixels.
      const off = document.createElement('canvas');
      off.width = W * dpr;
      off.height = H * dpr;
      offRef.current = off;
      genRef.current = -1;   // force heatmap redraw baseline
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── Column cadence: push a real depth snapshot column on a fixed beat ──
  useEffect(() => {
    const tick = () => {
      const hm = engines.heatmap;
      const off = offRef.current;
      const { W, H, dpr } = dimsRef.current;
      if (!hm || !off) return;

      // Buffer was rebuilt/cleared → wipe and resync generation.
      if (genRef.current !== hm.generation) {
        const octx = off.getContext('2d');
        octx.clearRect(0, 0, off.width, off.height);
        genRef.current = hm.generation;
      }

      if (!running) return;
      const book = getBook && getBook();
      if (book && book.ready && !book.isStale()) {
        const mid = book.mid();
        if (mid) {
          // Maintain the price→Y window ALWAYS (even with the heatmap toggled
          // off) so bubbles / BBO / icebergs stay correctly positioned.
          hm.maybeRecenter(mid);               // may bump generation → handled next tick
          if (toggles.heatmap) {
            hm.pushColumn(book);
            _scrollAndDrawColumn(off, hm, W, H, dpr);
          }
        }
      }
    };
    colTimerRef.current = setInterval(tick, columnIntervalMs);
    return () => clearInterval(colTimerRef.current);
  }, [engines, getBook, running, toggles.heatmap, columnIntervalMs]);

  // ── Overlay rAF loop: blit heatmap + draw bubbles/BBO/markers/axes ──
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const off = offRef.current;
      const { W, H, dpr } = dimsRef.current;
      const hm = engines.heatmap;
      if (canvas && off && hm) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);

        if (toggles.heatmap) {
          ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, W, H);
        }

        // ── SINGLE shared price→Y mapping ──────────────────────────────
        // Heatmap base (via priceToRow), BBO, bubbles, iceberg/stop markers and
        // the price line ALL derive their Y from this one yOf + the heatmap
        // engine's range, so a bubble at price P sits exactly on P's heat band.
        const pMin = hm.pMin, pMax = hm.pMax;
        const span = pMax - pMin;
        const yOf = (price) => span > 0 ? ((pMax - price) / span) * H : -1;
        const windowMs = engines.heatmap.maxCols * columnIntervalMs;
        const now = getNow ? getNow() : Date.now();
        const xOf = (ts) => W - ((now - ts) / windowMs) * W;

        drawAxes(ctx, { W, H, pMin, pMax });

        if (span > 0) {
          if (toggles.bbo)      drawBBO(ctx, engines.bbo, { W, H, yOf, xOf, now, windowMs });
          if (toggles.bubbles)  drawBubbles(ctx, engines.bubbles, { W, H, yOf, xOf, now });
          if (toggles.icebergs) _drawMarkers(ctx, engines.iceberg, { W, H, yOf, now });
          _drawPriceLine(ctx, getBook && getBook(), { W, H, yOf });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engines, getBook, getNow, toggles, columnIntervalMs]);

  return <div className="bm-canvas-wrap" ref={wrapRef}><canvas ref={canvasRef} className="bm-canvas" /></div>;

  // ── helpers (closures over heatColor) ──
  function _scrollAndDrawColumn(off, hm, W, H, dpr) {
    const octx = off.getContext('2d');
    const colW = (W / hm.maxCols) * dpr;
    // Scroll existing content left by one column.
    octx.globalCompositeOperation = 'copy';
    octx.drawImage(off, -colW, 0);
    octx.globalCompositeOperation = 'source-over';
    // Clear the new rightmost strip, then rasterise the newest column.
    const xRight = off.width - colW;
    octx.clearRect(xRight, 0, colW, off.height);
    const col = hm.columns[hm.columns.length - 1];
    if (!col) return;
    const rowH = off.height / hm.rows;
    const norm = hm.maxIntensity || 1;
    for (let r = 0; r < hm.rows; r++) {
      const v = col[r];
      if (v <= 0) continue;
      const t = Math.pow(v / norm, 0.55);   // gamma lift so mid liquidity shows
      octx.fillStyle = heatColor(t);
      octx.fillRect(xRight, r * rowH, colW + 1, rowH + 1);
    }
  }
}

function _drawMarkers(ctx, iceberg, { W, H, yOf, now }) {
  for (const ev of iceberg.events) {
    const y = yOf(ev.price);
    if (y < 0 || y > H) continue;
    const age = (now - ev.ts) / iceberg.eventLifeMs;
    const alpha = Math.max(0.15, 1 - age);
    if (ev.type === 'iceberg') {
      ctx.fillStyle = `rgba(168,139,250,${alpha})`;
      ctx.strokeStyle = `rgba(168,139,250,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(W - 60, y);
      ctx.lineTo(W - 50, y - 5);
      ctx.lineTo(W - 50, y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🧊 ${ev.info}`, W - 48, y + 3);
    } else {
      ctx.strokeStyle = ev.side === 'up' ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ STOP ${ev.side === 'up' ? '▲' : '▼'} ${ev.info}`, 6, y - 4);
    }
  }
}

function _drawPriceLine(ctx, book, { W, H, yOf }) {
  if (!book || !book.ready) return;
  const mid = book.mid();
  if (mid == null) return;
  const y = yOf(mid);
  if (y < 0 || y > H) return;
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y); ctx.lineTo(W, y);
  ctx.stroke();
  ctx.setLineDash([]);
}
