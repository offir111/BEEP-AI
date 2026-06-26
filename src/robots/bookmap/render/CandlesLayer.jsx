/**
 * CandlesLayer — pure canvas draw for OHLC candlesticks built from real
 * aggTrades (CandleEngine). Bookmap-style thin candles: green body up, red down,
 * with a high/low wick. Shares the chart's yOf + xOf so candles sit on the same
 * price axis as the heatmap and bubbles.
 */
export function drawCandles(ctx, engine, { W, H, yOf, xOf }) {
  if (!engine || !engine.candles || engine.candles.length === 0) return;
  const tf = engine.tf;
  const candles = engine.candles;
  // Body ≈ 65% of the time slice, min 4px so candles are clearly visible.
  const slice = Math.abs(xOf(tf) - xOf(0));
  const w = Math.max(4, slice * 0.65);

  for (const c of candles) {
    const xc = xOf(c.t + tf / 2);
    if (xc < -w || xc > W + w) continue;
    const up = c.c >= c.o;
    const col = up ? '#2ecc71' : '#ff4d4d';   // bright green / red
    const yHigh = yOf(c.h), yLow = yOf(c.l);
    const yOpen = yOf(c.o), yClose = yOf(c.c);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBot = Math.max(yOpen, yClose);
    const bx = Math.round(xc - w / 2);
    const bw = Math.round(w);

    // wick (1.5px, centred)
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.round(xc) + 0.5, yHigh);
    ctx.lineTo(Math.round(xc) + 0.5, yLow);
    ctx.stroke();

    // body with a thin dark outline so it separates from the heatmap
    const h = Math.max(2, bodyBot - bodyTop);
    ctx.fillStyle = col;
    ctx.fillRect(bx, bodyTop, bw, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, bodyTop + 0.5, bw - 1, h - 1);
  }
}
