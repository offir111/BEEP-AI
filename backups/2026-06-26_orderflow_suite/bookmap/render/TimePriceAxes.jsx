/**
 * TimePriceAxes — pure canvas draw for the price (Y) grid labels and a time
 * tick on the X axis. Bookmap-style: faint horizontal price gridlines with
 * the price printed on the right gutter.
 */
function fmtPrice(p) {
  if (p == null) return '';
  if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 1)    return p.toFixed(2);
  return p.toFixed(5);
}

export function drawAxes(ctx, { W, H, pMin, pMax, rowToPrice }) {
  if (!(pMax > pMin)) return;
  const lines = 8;
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= lines; i++) {
    const y = (i / lines) * H;
    const price = pMax - (i / lines) * (pMax - pMin);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // White, bold, with a dark outline so prices stay readable over the heatmap.
    const label = fmtPrice(price);
    const ty = y + 6;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, W - 4, ty);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(label, W - 4, ty);
  }
}

export { fmtPrice };
