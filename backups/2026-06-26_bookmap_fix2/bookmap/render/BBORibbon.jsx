/**
 * BBORibbon — pure canvas draw for the best bid / best offer ribbon and the
 * absorption flag. The bid line (green) and ask line (red) trace the real touch
 * over time; the band between them is the live spread.
 */
export function drawBBO(ctx, engine, { W, H, yOf, xOf, now, windowMs }) {
  const pts = engine.points;
  if (pts.length < 2) return;

  const xForPt = (ts) => xOf(ts);

  // Spread band
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < pts.length; i++) {
    const x = xForPt(pts[i].ts);
    const y = yOf(pts[i].ask);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const x = xForPt(pts[i].ts);
    ctx.lineTo(x, yOf(pts[i].bid));
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(212,175,55,0.10)';
  ctx.fill();

  // Bid line (green)
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xForPt(p.ts), y = yOf(p.bid);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(74,222,128,0.9)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Ask line (red)
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xForPt(p.ts), y = yOf(p.ask);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(248,113,113,0.9)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Absorption flag (recent only)
  const ab = engine.absorption;
  if (ab && (now - ab.ts) < 4000) {
    const y = yOf(ab.price);
    const x = W - 6;
    ctx.fillStyle = ab.side === 'bid' ? 'rgba(74,222,128,0.95)' : 'rgba(248,113,113,0.95)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('⊟ ספיגה', x, y - 4);
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    ctx.strokeStyle = ab.side === 'bid' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
