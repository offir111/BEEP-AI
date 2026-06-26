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
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= lines; i++) {
    const y = (i / lines) * H;
    const price = pMax - (i / lines) * (pMax - pMin);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,160,176,0.75)';
    ctx.fillText(fmtPrice(price), W - 4, y + 7);
  }
}

export { fmtPrice };
