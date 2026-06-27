/**
 * VolumeProfilePanel — right-side panel, Binance/crypto take on Bookmap's COB /
 * volume columns. Two stacked-by-price histograms sharing the chart's price→Y:
 *
 *   • COB (Current Order Book): resting liquidity per price level from the live
 *     OrderBookState — bid green / ask red.
 *   • Vol Profile: traded volume per price level from accumulated aggTrades,
 *     split buy (green) / sell (red).
 *
 * Same height + same range as the heatmap, so every row lines up with the chart.
 * Anything not available for crypto is simply omitted — never faked.
 */
import { useRef, useEffect } from 'react';

const ROWS = 130;

export default function VolumeProfilePanel({ engines, getBook }) {
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
      const H = Math.max(40, Math.floor(rect.height));
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
      const hm = engines.heatmap;
      if (canvas && hm) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const pMin = hm.pMin, pMax = hm.pMax, span = pMax - pMin;
        const cobW = Math.floor(W * 0.42);   // left zone = COB
        const vpX = cobW + 4;
        const vpW = W - vpX;

        // headers
        ctx.fillStyle = 'rgba(160,160,176,0.8)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COB', cobW / 2, 11);
        ctx.fillText('Vol Profile', vpX + vpW / 2, 11);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(vpX - 2, 14); ctx.lineTo(vpX - 2, H); ctx.stroke();

        if (span > 0) {
          const rowH = H / ROWS;
          const yOfRow = (r) => 14 + (r / ROWS) * (H - 14);

          // ── COB: resting liquidity from the live book ──
          const book = getBook && getBook();
          if (book && book.ready) {
            const bidBins = new Float32Array(ROWS);
            const askBins = new Float32Array(ROWS);
            let cobMax = 0;
            const { bids, asks } = book.levelsInRange(pMin, pMax);
            for (const l of bids) {
              const r = Math.min(ROWS - 1, Math.floor((pMax - l.price) / span * ROWS));
              bidBins[r] += l.qty; if (bidBins[r] > cobMax) cobMax = bidBins[r];
            }
            for (const l of asks) {
              const r = Math.min(ROWS - 1, Math.floor((pMax - l.price) / span * ROWS));
              askBins[r] += l.qty; if (askBins[r] > cobMax) cobMax = askBins[r];
            }
            cobMax = cobMax || 1;
            for (let r = 0; r < ROWS; r++) {
              const y = yOfRow(r);
              if (bidBins[r] > 0) {
                const w = (bidBins[r] / cobMax) * cobW;
                ctx.fillStyle = 'rgba(38,208,124,0.75)';
                ctx.fillRect(cobW - w, y, w, Math.max(1, rowH));
              }
              if (askBins[r] > 0) {
                const w = (askBins[r] / cobMax) * cobW;
                ctx.fillStyle = 'rgba(239,67,97,0.75)';
                ctx.fillRect(cobW - w, y, w, Math.max(1, rowH));
              }
            }
          }

          // ── Vol Profile: traded volume per level ──
          const { buy, sell, max } = engines.profile.profile(pMin, pMax, ROWS);
          const vmax = max || 1;
          for (let r = 0; r < ROWS; r++) {
            const y = yOfRow(r);
            const tot = buy[r] + sell[r];
            if (tot <= 0) continue;
            const wTot = (tot / vmax) * vpW;
            const wBuy = tot > 0 ? wTot * (buy[r] / tot) : 0;
            ctx.fillStyle = 'rgba(38,208,124,0.8)';
            ctx.fillRect(vpX, y, wBuy, Math.max(1, rowH));
            ctx.fillStyle = 'rgba(239,67,97,0.8)';
            ctx.fillRect(vpX + wBuy, y, wTot - wBuy, Math.max(1, rowH));
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engines, getBook]);

  return (
    <div className="bm-vprofile" ref={wrapRef}>
      <canvas ref={canvasRef} className="bm-vprofile-canvas" />
    </div>
  );
}
