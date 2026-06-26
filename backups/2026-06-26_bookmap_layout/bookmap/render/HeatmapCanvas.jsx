/**
 * HeatmapCanvas — the Bookmap-style chart surface. One <canvas>, one rAF loop.
 *
 * Layers (bottom → top), ALL sharing one price→Y mapping + time axis:
 *   1. Liquidity heatmap (HeatmapEngine grid, re-mapped to the live range)
 *   2. Candlesticks (CandleEngine)
 *   3. BBO ribbon, Volume bubbles (3D), Iceberg/Stop markers
 *   4. Moving price line, price axis labels
 *
 * The price axis is stable & auto-ranging (see HeatmapEngine): the range only
 * changes once per cadence tick, so heatmap + overlays stay pixel-aligned.
 * Everything is real Binance data — when the book is stale nothing advances.
 */
import { useRef, useEffect } from 'react';
import { drawBubbles } from './VolumeBubblesLayer';
import { drawCandles } from './CandlesLayer';
import { drawBBO } from './BBORibbon';
import { drawAxes } from './TimePriceAxes';

// intensity 0..1 → dark → blue → cyan → green → yellow → orange → bright red
// (Bookmap-style palette). Returns [r,g,b] 0..255.
function heatRGB(t) {
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.18)      { const u = t / 0.18;          r = 6 + u * 6;     g = 10 + u * 30;   b = 30 + u * 130; }
  else if (t < 0.38) { const u = (t - 0.18) / 0.20; r = 12;            g = 40 + u * 150;  b = 160 + u * 70; }
  else if (t < 0.58) { const u = (t - 0.38) / 0.20; r = 12 + u * 30;   g = 190 + u * 40;  b = 230 - u * 180; }
  else if (t < 0.78) { const u = (t - 0.58) / 0.20; r = 42 + u * 200;  g = 230;           b = 50 - u * 50; }
  else               { const u = (t - 0.78) / 0.22; r = 242;           g = 230 - u * 200; b = 0; }
  return [r | 0, g | 0, b | 0];
}

export default function HeatmapCanvas({
  engines, getBook, getNow, running = true,
  toggles, columnIntervalMs = 200,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const offRef = useRef(null);        // small heatmap buffer (maxCols × rows)
  const gridRef = useRef(null);
  const dimsRef = useRef({ W: 0, H: 0, dpr: 1 });
  const genRef = useRef(-1);
  const rafRef = useRef(0);
  const colTimerRef = useRef(0);

  // ── Size to container ──
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
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // small offscreen at grid resolution (independent of pixel size)
  useEffect(() => {
    const hm = engines.heatmap;
    const off = document.createElement('canvas');
    off.width = hm.maxCols;
    off.height = hm.rows;
    offRef.current = off;
    gridRef.current = new Float32Array(hm.maxCols * hm.rows);
  }, [engines]);

  // ── Column cadence: sample range, push column, rebuild heatmap buffer ──
  useEffect(() => {
    const tick = () => {
      const hm = engines.heatmap;
      const off = offRef.current;
      if (!hm || !off) return;

      if (genRef.current !== hm.generation) {     // symbol switch / clear
        off.getContext('2d').clearRect(0, 0, off.width, off.height);
        genRef.current = hm.generation;
      }
      if (!running) return;
      const book = getBook && getBook();
      if (book && book.ready && !book.isStale()) {
        const mid = book.mid();
        if (mid) {
          // Maintain the shared range ALWAYS (so bubbles/candles stay aligned
          // even with the heatmap toggled off).
          hm.recordSample(mid, getNow ? getNow() : Date.now());
          hm.pushColumn(book);
          if (toggles.heatmap) _renderHeatmap(off, hm);
        }
      }
    };
    colTimerRef.current = setInterval(tick, columnIntervalMs);
    return () => clearInterval(colTimerRef.current);
  }, [engines, getBook, getNow, running, toggles.heatmap, columnIntervalMs]);

  // ── Overlay rAF loop ──
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
          ctx.imageSmoothingEnabled = true;       // bilinear upscale → smooth map
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, W, H);
        }

        // ── SINGLE shared price→Y mapping for every layer ──
        const pMin = hm.pMin, pMax = hm.pMax;
        const span = pMax - pMin;
        const yOf = (price) => span > 0 ? ((pMax - price) / span) * H : -1;
        const windowMs = hm.maxCols * columnIntervalMs;
        const now = getNow ? getNow() : Date.now();
        const xOf = (ts) => W - ((now - ts) / windowMs) * W;

        drawAxes(ctx, { W, H, pMin, pMax });

        if (span > 0) {
          if (toggles.bbo)      drawBBO(ctx, engines.bbo, { W, H, yOf, xOf, now, windowMs });
          if (toggles.candles)  drawCandles(ctx, engines.candle, { W, H, yOf, xOf });
          if (toggles.bubbles)  drawBubbles(ctx, engines.bubbles, { W, H, yOf, xOf, now });
          if (toggles.icebergs) _drawMarkers(ctx, engines.iceberg, { W, H, yOf, now });
          _drawPriceLine(ctx, engines.heatmap, { W, H, yOf, xOf, getBook });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engines, getBook, getNow, toggles, columnIntervalMs]);

  return <div className="bm-canvas-wrap" ref={wrapRef}><canvas ref={canvasRef} className="bm-canvas" /></div>;

  // Rasterise the heatmap grid to the small offscreen via ImageData (palette),
  // with a light vertical smear so the upscaled map reads as continuous.
  function _renderHeatmap(off, hm) {
    const grid = hm.buildGrid(gridRef.current);
    gridRef.current = grid;
    const { rows, maxCols } = hm;
    const norm = hm.maxIntensity || 1;
    const octx = off.getContext('2d');
    const img = octx.createImageData(maxCols, rows);
    const d = img.data;
    for (let x = 0; x < maxCols; x++) {
      const base = x * rows;
      for (let r = 0; r < rows; r++) {
        // vertical smear: blend the cell with its neighbours (1-2-1)
        const v = (grid[base + r] * 2 +
                   (r > 0 ? grid[base + r - 1] : 0) +
                   (r < rows - 1 ? grid[base + r + 1] : 0)) / 4;
        if (v <= 0) continue;
        const t = Math.pow(v / norm, 0.55);
        const [cr, cg, cb] = heatRGB(t);
        const idx = (r * maxCols + x) * 4;
        d[idx] = cr; d[idx + 1] = cg; d[idx + 2] = cb;
        d[idx + 3] = Math.min(255, 60 + t * 195);   // faint→opaque with intensity
      }
    }
    octx.putImageData(img, 0, 0);
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

// Moving price line — thin bright trace of recent mid prices over time.
function _drawPriceLine(ctx, hm, { W, H, yOf, xOf, getBook }) {
  const samples = hm.samples;
  if (samples && samples.length > 1) {
    ctx.beginPath();
    let started = false;
    for (const s of samples) {
      const x = xOf(s.ts), y = yOf(s.price);
      if (y < -20 || y > H + 20) { started = false; continue; }
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(230,230,245,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // current-price dashed level + tag
  const book = getBook && getBook();
  const mid = book && book.ready ? book.mid() : null;
  if (mid == null) return;
  const y = yOf(mid);
  if (y < 0 || y > H) return;
  ctx.strokeStyle = 'rgba(212,175,55,0.6)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y); ctx.lineTo(W, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export { heatRGB };
