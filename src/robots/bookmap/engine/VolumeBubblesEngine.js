/**
 * VolumeBubblesEngine — turns real aggTrades into bubbles that drift left across
 * the WHOLE visible time window (Bookmap style), one per trade (close same-side
 * trades merged): radius ∝ executed volume, green = aggressive buy, red = sell.
 *
 * • lifeMs matches the chart's visible window so bubbles spread along the whole
 *   width instead of clumping at the right edge.
 * • Tiny trades below a dynamic noise floor are dropped to declutter.
 * Nothing is invented.
 */
export default class VolumeBubblesEngine {
  constructor({ lifeMs = 58000, maxBubbles = 1600, mergeMs = 400, noiseFactor = 0.45 } = {}) {
    this.lifeMs = lifeMs;
    this.maxBubbles = maxBubbles;
    this.mergeMs = mergeMs;
    this.noiseFactor = noiseFactor;
    this.bubbles = [];      // { price, qty, buy, ts }
    this.maxQty = 0;        // smoothed normaliser for radius
    this._ema = 0;          // EMA of trade notional (noise floor)
    this._n = 0;
  }

  addTrade(t) {
    const notional = t.price * t.qty;
    this._n++;
    const a = this._n < 50 ? 1 / this._n : 0.02;
    this._ema += a * (notional - this._ema);
    // Drop sub-threshold noise once we have a baseline (keeps the field clean).
    if (this._n > 40 && notional < this._ema * this.noiseFactor) return;

    const buy = !t.buyerMaker;     // buyerMaker=true → aggressive sell
    // Merge with the most recent same-side bubble at the same price within mergeMs.
    const last = this.bubbles[this.bubbles.length - 1];
    if (last && last.buy === buy && last.price === t.price && (t.ts - last.ts) < this.mergeMs) {
      last.qty += t.qty;
      last.ts = t.ts;
      if (last.qty > this.maxQty) this.maxQty = last.qty;
      return;
    }
    this.bubbles.push({ price: t.price, qty: t.qty, buy, ts: t.ts });
    if (t.qty > this.maxQty) this.maxQty = t.qty;
    if (this.bubbles.length > this.maxBubbles) this.bubbles.shift();
  }

  /** Drop expired bubbles relative to `now`. */
  prune(now) {
    const cutoff = now - this.lifeMs;
    while (this.bubbles.length && this.bubbles[0].ts < cutoff) this.bubbles.shift();
    this.maxQty *= 0.9995;   // slow decay so radius scale tracks current activity
  }

  clear() { this.bubbles = []; this.maxQty = 0; this._ema = 0; this._n = 0; }
}
