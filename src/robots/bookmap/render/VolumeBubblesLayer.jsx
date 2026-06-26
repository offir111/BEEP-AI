/**
 * VolumeBubblesLayer — pure canvas draw for the volume bubbles overlay.
 * Green = aggressive buy, red = aggressive sell. Radius ∝ executed volume.
 * Imported and composed by HeatmapCanvas (single canvas, single rAF).
 */
export function drawBubbles(ctx, engine, { W, H, yOf, xOf, now }) {
  const maxQty = engine.maxQty || 1;
  for (const b of engine.bubbles) {
    const x = xOf(b.ts);
    const y = yOf(b.price);
    if (x < -40 || x > W + 40 || y < 0 || y > H) continue;
    const age = (now - b.ts) / engine.lifeMs;          // 0..1
    const alpha = Math.max(0, 0.85 * (1 - age));
    const r = 3 + 22 * Math.sqrt(Math.min(1, b.qty / maxQty));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (b.buy) {
      ctx.fillStyle = `rgba(34,197,94,${alpha * 0.5})`;
      ctx.strokeStyle = `rgba(74,222,128,${alpha})`;
    } else {
      ctx.fillStyle = `rgba(239,68,68,${alpha * 0.5})`;
      ctx.strokeStyle = `rgba(248,113,113,${alpha})`;
    }
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
