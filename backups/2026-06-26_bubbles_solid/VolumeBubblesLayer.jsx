/**
 * VolumeBubblesLayer — 3D-looking volume bubbles (Bookmap style). Each real
 * aggTrade is a sphere: radial gradient (bright core → dark rim) for depth,
 * green for aggressive buys, salmon/pink for aggressive sells. Radius ∝ executed
 * volume; semi-transparent so overlapping bubbles read nicely.
 */
export function drawBubbles(ctx, engine, { W, H, yOf, xOf, now }) {
  const maxQty = engine.maxQty || 1;
  ctx.save();
  for (const b of engine.bubbles) {
    const x = xOf(b.ts);
    const y = yOf(b.price);
    if (x < -60 || x > W + 60 || y < -30 || y > H + 30) continue;
    const age = (now - b.ts) / engine.lifeMs;          // 0..1
    if (age >= 1) continue;
    // Semi-transparent (~0.5–0.65) so the heatmap reads through; gentle fade with age.
    const alpha = Math.max(0.12, 0.66 * (1 - age * 0.5));
    // Radius ∝ volume, clamped so small trades still read and giants don't blow up.
    const r = Math.min(34, 5 + 34 * Math.sqrt(Math.min(1, b.qty / maxQty)));

    const core = b.buy ? [190, 255, 210] : [255, 205, 215];
    const mid  = b.buy ? [46, 208, 124]  : [255, 77, 109];
    const rim  = b.buy ? [10, 120, 64]   : [165, 30, 64];

    // soft glow → bubble floats above heatmap/candles
    ctx.shadowColor = b.buy ? `rgba(46,208,124,${alpha * 0.7})` : `rgba(255,77,109,${alpha * 0.7})`;
    ctx.shadowBlur = Math.min(26, r * 0.9);

    const g = ctx.createRadialGradient(x - r * 0.34, y - r * 0.34, r * 0.08, x, y, r);
    g.addColorStop(0,   `rgba(${core[0]},${core[1]},${core[2]},${alpha})`);
    g.addColorStop(0.45,`rgba(${mid[0]},${mid[1]},${mid[2]},${alpha * 0.9})`);
    g.addColorStop(1,   `rgba(${rim[0]},${rim[1]},${rim[2]},${alpha * 0.8})`);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // bright rim highlight (no shadow on the stroke)
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(${core[0]},${core[1]},${core[2]},${alpha * 0.7})`;
    ctx.stroke();
  }
  ctx.restore();
}
