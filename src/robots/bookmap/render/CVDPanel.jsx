/**
 * CVDPanel — Cumulative Volume Delta strip under the main chart. Shares the
 * chart's time axis (same now + windowMs + width) so it lines up tick-for-tick.
 * Green fill above the zero baseline, red below.
 */
import { useRef, useEffect } from 'react';

export default function CVDPanel({ engines, getNow, columnIntervalMs = 200 }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const dims = useRef({ W: 0, H: 0, dpr: 1 });

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(40, Math.floor(rect.width));
      const H = Math.max(30, Math.floor(rect.height));
      dims.current = { W, H, dpr };
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const { W, H, dpr } = dims.current;
      const cvd = engines.cvd;
      if (canvas && cvd) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#070810';
        ctx.fillRect(0, 0, W, H);

        const now = getNow ? getNow() : Date.now();
        const windowMs = engines.heatmap.maxCols * columnIntervalMs;
        const pts = cvd.points.filter(p => p.ts >= now - windowMs);

        ctx.fillStyle = 'rgba(160,160,176,0.7)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('CVD', W - 4, 11);

        if (pts.length >= 2) {
          let lo = Infinity, hi = -Infinity;
          for (const p of pts) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
          if (lo > 0) lo = 0; if (hi < 0) hi = 0;           // keep zero in view
          const pad = (hi - lo) * 0.12 || 1;
          lo -= pad; hi += pad;
          const span = hi - lo || 1;
          const xOf = (ts) => W - ((now - ts) / windowMs) * W;
          const yOf = (v) => H - ((v - lo) / span) * H;
          const yZero = yOf(0);

          // baseline
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, yZero); ctx.lineTo(W, yZero); ctx.stroke();

          // fill to baseline (split green above / red below)
          ctx.beginPath();
          ctx.moveTo(xOf(pts[0].ts), yZero);
          for (const p of pts) ctx.lineTo(xOf(p.ts), yOf(p.v));
          ctx.lineTo(xOf(pts[pts.length - 1].ts), yZero);
          ctx.closePath();
          const endAbove = pts[pts.length - 1].v >= 0;
          ctx.fillStyle = endAbove ? 'rgba(38,208,124,0.22)' : 'rgba(239,67,97,0.22)';
          ctx.fill();

          // line (coloured by sign of the latest value)
          ctx.beginPath();
          pts.forEach((p, i) => {
            const x = xOf(p.ts), y = yOf(p.v);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.strokeStyle = endAbove ? 'rgba(46,208,124,0.95)' : 'rgba(255,90,110,0.95)';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          // current value
          ctx.fillStyle = endAbove ? '#2ecc71' : '#ff5a6e';
          ctx.textAlign = 'left';
          const cur = pts[pts.length - 1].v;
          ctx.fillText((cur >= 0 ? '+' : '') + cur.toFixed(2), 4, 11);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engines, getNow, columnIntervalMs]);

  return <div className="bm-cvd" ref={wrapRef}><canvas ref={canvasRef} className="bm-cvd-canvas" /></div>;
}
