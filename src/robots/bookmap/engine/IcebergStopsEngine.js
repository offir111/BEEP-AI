/**
 * IcebergStopsEngine — detects two real microstructure events from live data:
 *
 *  • ICEBERG: a price level whose resting size keeps REFILLING after being eaten.
 *    We watch a level: trades hit it (size shrinks), then the book shows size
 *    back at/above a threshold again. Repeated refills (≥3) at the same price
 *    → hidden iceberg order.
 *
 *  • STOP RUN / SWEEP: a fast one-directional burst of aggressive trades that
 *    crosses several price levels within a short window → stops being run.
 *
 * Both fire ONLY from real book/trade events, never a timer. Events expire so
 * markers fade.
 */
export default class IcebergStopsEngine {
  constructor({ refillThreshold = 3, sweepLevels = 4, sweepWindowMs = 1200, eventLifeMs = 8000 } = {}) {
    this.refillThreshold = refillThreshold;
    this.sweepLevels = sweepLevels;
    this.sweepWindowMs = sweepWindowMs;
    this.eventLifeMs = eventLifeMs;

    this.levelWatch = new Map();   // priceStr -> { lastQty, eaten, refills }
    this.recentTrades = [];        // for sweep detection: { price, buy, ts }
    this.events = [];              // { type:'iceberg'|'stop', price, side, ts, info }
  }

  /** Called on each trade — drives both detectors. */
  onTrade(t) {
    const key = t.price.toString();
    const w = this.levelWatch.get(key);
    if (w) w.eaten += t.qty;       // this level is being consumed

    // Sweep detection: keep a short window of recent trades.
    this.recentTrades.push({ price: t.price, buy: !t.buyerMaker, ts: t.ts });
    const cutoff = t.ts - this.sweepWindowMs;
    while (this.recentTrades.length && this.recentTrades[0].ts < cutoff) this.recentTrades.shift();
    this._checkSweep(t.ts);
  }

  _checkSweep(now) {
    const buys = this.recentTrades.filter(x => x.buy);
    const sells = this.recentTrades.filter(x => !x.buy);
    const side = buys.length >= sells.length ? buys : sells;
    if (side.length < 6) return;
    const prices = new Set(side.map(x => x.price));
    if (prices.size >= this.sweepLevels) {
      const isBuy = side === buys;
      const last = this.events[this.events.length - 1];
      // de-dup: one stop event per burst
      if (!last || last.type !== 'stop' || (now - last.ts) > this.sweepWindowMs) {
        const arr = [...prices];
        this.events.push({
          type: 'stop',
          price: isBuy ? Math.max(...arr) : Math.min(...arr),
          side: isBuy ? 'up' : 'down',
          ts: now,
          info: `${prices.size} רמות`,
        });
      }
    }
  }

  /**
   * Called on each book update — drives iceberg refill detection.
   * We sample sizes near the touch and notice when an eaten level comes back.
   */
  onBook(book) {
    const { bids, asks } = book.topLevels(8);
    const now = Date.now();
    const sample = [...bids.map(l => ({ ...l, side: 'bid' })), ...asks.map(l => ({ ...l, side: 'ask' }))];
    for (const lv of sample) {
      const key = lv.price.toString();
      let w = this.levelWatch.get(key);
      if (!w) { this.levelWatch.set(key, { lastQty: lv.qty, eaten: 0, refills: 0, side: lv.side }); continue; }
      // A refill = the level was meaningfully eaten, then size returned to ~prev.
      if (w.eaten > w.lastQty * 0.5 && lv.qty >= w.lastQty * 0.8) {
        w.refills += 1;
        w.eaten = 0;
        if (w.refills >= this.refillThreshold) {
          const last = this.events[this.events.length - 1];
          if (!last || last.type !== 'iceberg' || last.price !== lv.price || (now - last.ts) > this.eventLifeMs) {
            this.events.push({ type: 'iceberg', price: lv.price, side: lv.side, ts: now, info: `×${w.refills}` });
          }
          w.refills = 0;
        }
      }
      w.lastQty = lv.qty;
    }
    // Keep the watch map bounded.
    if (this.levelWatch.size > 400) {
      const keys = [...this.levelWatch.keys()].slice(0, 200);
      for (const k of keys) this.levelWatch.delete(k);
    }
  }

  prune(now) {
    const cutoff = now - this.eventLifeMs;
    this.events = this.events.filter(e => e.ts >= cutoff);
  }

  clear() {
    this.levelWatch.clear();
    this.recentTrades = [];
    this.events = [];
  }
}
