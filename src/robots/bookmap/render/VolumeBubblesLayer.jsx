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
    if (x < -50 || x > W + 50 || y < -20 || y > H + 20) continue;
    const age = (now - b.ts) / engine.lifeMs;          // 0..1
    if (age >= 1) continue;
    const alpha = Math.max(0, 0.9 * (1 - age * 0.7));
    const r = 3 + 26 * Math.sqrt(Math.min(1, b.qty / maxQty));

    // 3D sphere: offset highlight + radial gradient core→rim
    const core = b.buy ? [180, 255, 200] : [255, 200, 210];
    const mid  = b.buy ? [46, 208, 124]  : [239, 67, 97];
    const rim  = b.buy ? [12, 110, 60]   : [150, 28, 60];
    const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.1, x, y, r);
    g.addColorStop(0,   `rgba(${core[0]},${core[1]},${core[2]},${alpha})`);
    g.addColorStop(0.45,`rgba(${mid[0]},${mid[1]},${mid[2]},${alpha * 0.92})`);
    g.addColorStop(1,   `rgba(${rim[0]},${rim[1]},${rim[2]},${alpha * 0.85})`);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${alpha})`;
    ctx.stroke();
  }
  ctx.restore();
}
