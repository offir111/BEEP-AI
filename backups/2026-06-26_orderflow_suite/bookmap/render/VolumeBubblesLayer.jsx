/**
 * VolumeBubblesLayer — solid, opaque, glossy 3D spheres (Bookmap style).
 * Each real aggTrade is a glass marble: full color (no transparency — the
 * heatmap does NOT show through), top-left highlight, dark bottom-right shadow,
 * a small specular glint and a soft drop shadow. Green = aggressive buy,
 * salmon-red = aggressive sell. Drawn above heatmap + candles + price line.
 */
export function drawBubbles(ctx, engine, { W, H, yOf, xOf, now }) {
  const maxQty = engine.maxQty || 1;
  ctx.save();
  for (const b of engine.bubbles) {
    const x = xOf(b.ts);
    const y = yOf(b.price);
    if (x < -60 || x > W + 60 || y < -30 || y > H + 30) continue;
    if ((now - b.ts) / engine.lifeMs >= 1) continue;
    const r = Math.min(34, 5 + 34 * Math.sqrt(Math.min(1, b.qty / maxQty)));

    // thick, saturated colours
    const hi  = b.buy ? '210,255,220' : '255,215,205';   // bright (near-white tint)
    const top = b.buy ? '70,224,140'  : '255,120,120';   // lit upper colour
    const mid = b.buy ? '34,190,104'  : '236,76,84';     // solid body colour
    const dk  = b.buy ? '9,92,52'      : '150,32,46';     // shadow rim

    // soft drop shadow under the sphere (cast from an opaque disc)
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.min(12, r * 0.5);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${mid})`;     // fully opaque base
    ctx.fill();

    // turn the shadow off before the gloss layers
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 3D sphere shading: highlight (top-left) → body → dark rim (bottom-right)
    const hx = x - r * 0.34, hy = y - r * 0.36;
    const g = ctx.createRadialGradient(hx, hy, r * 0.05, x, y, r);
    g.addColorStop(0,    `rgb(${hi})`);
    g.addColorStop(0.28, `rgb(${top})`);
    g.addColorStop(0.7,  `rgb(${mid})`);
    g.addColorStop(1,    `rgb(${dk})`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // specular glint (stays inside the sphere — transparent at its edge)
    const sx = x - r * 0.36, sy = y - r * 0.4;
    const sr = r * 0.55;
    const sp = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sp.addColorStop(0,   'rgba(255,255,255,0.9)');
    sp.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    sp.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = sp;
    ctx.fill();

    // crisp dark rim for definition against the chart
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${dk},0.85)`;
    ctx.stroke();
  }
  ctx.restore();
}
