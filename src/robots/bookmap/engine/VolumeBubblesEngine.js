/**
 * VolumeBubblesEngine — turns real aggTrades into bubbles drifting left over
 * the heatmap. One bubble per trade (small adjacent trades merged briefly):
 *   radius ∝ executed volume, green = aggressive buy, red = aggressive sell.
 *
 * Bubbles age out after `lifeMs`. A big real trade → a big bubble in the right
 * colour. Nothing is invented.
 */
export default class VolumeBubblesEngine {
  constructor({ lifeMs = 12000, maxBubbles = 400, mergeMs = 250 } = {}) {
    this.lifeMs = lifeMs;
    this.maxBubbles = maxBubbles;
    this.mergeMs = mergeMs;
    this.bubbles = [];      // { price, qty, buy, ts }
    this.maxQty = 0;        // smoothed normaliser for radius
  }

  addTrade(t) {
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
    this.maxQty *= 0.999;   // slow decay so radius scale tracks current activity
  }

  clear() { this.bubbles = []; this.maxQty = 0; }
}
