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
  const w = Math.max(2, Math.abs(xOf(tf) - xOf(0)) * 0.7);

  for (const c of candles) {
    const xc = xOf(c.t + tf / 2);
    if (xc < -w || xc > W + w) continue;
    const up = c.c >= c.o;
    const col = up ? '#26d07c' : '#ef4361';
    const yHigh = yOf(c.h), yLow = yOf(c.l);
    const yOpen = yOf(c.o), yClose = yOf(c.c);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBot = Math.max(yOpen, yClose);

    // wick
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xc, yHigh);
    ctx.lineTo(xc, yLow);
    ctx.stroke();

    // body (min 1px tall)
    ctx.fillStyle = col;
    const h = Math.max(1, bodyBot - bodyTop);
    ctx.fillRect(xc - w / 2, bodyTop, w, h);
  }
}
