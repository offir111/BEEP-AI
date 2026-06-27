/**
 * SpoofEngine — detects spoofing / layering: a large resting order (wall) that
 * appears in the book away from the touch and is then CANCELLED quickly, before
 * price ever reaches it. Driven purely by real OrderBookState dynamics.
 *
 *   onBook(book, now):
 *     • a level whose size is a large fraction of the biggest visible level,
 *       sitting away from mid, is "watched" from the moment it appears.
 *     • if that watched wall vanishes (size → <50%) within cancelMs while the
 *       mid never reached its price → spoof event at that price.
 */
export default class SpoofEngine {
  constructor({ wallFactor = 0.45, cancelMs = 6000, eventLifeMs = 8000 } = {}) {
    this.wallFactor = wallFactor;
    this.cancelMs = cancelMs;
    this.eventLifeMs = eventLifeMs;
    this.watch = new Map();   // priceStr -> { price, qty, side, ts }
    this.events = [];         // { price, side, ts }
  }

  onBook(book, now = Date.now()) {
    if (!book || !book.ready) return;
    const { bids, asks } = book.topLevels(30);
    const all = [
      ...bids.map(l => ({ ...l, side: 'bid' })),
      ...asks.map(l => ({ ...l, side: 'ask' })),
    ];
    if (!all.length) return;
    const mid = book.mid();
    if (mid == null) return;
    let maxQ = 1;
    for (const l of all) if (l.qty > maxQ) maxQ = l.qty;

    const byKey = new Map(all.map(l => [l.price.toString(), l]));

    // Register new big walls (away from the touch).
    for (const l of all) {
      const key = l.price.toString();
      const awayFromTouch = Math.abs(l.price - mid) > mid * 0.0004;
      if (l.qty >= maxQ * this.wallFactor && awayFromTouch && !this.watch.has(key)) {
        this.watch.set(key, { price: l.price, qty: l.qty, side: l.side, ts: now });
      }
    }

    // Detect cancellations of watched walls before price reached them.
    for (const [key, w] of this.watch) {
      const cur = byKey.get(key);
      const stillBig = cur && cur.qty >= w.qty * 0.5;
      if (!stillBig) {
        const age = now - w.ts;
        const reached = (w.side === 'bid' && mid <= w.price) || (w.side === 'ask' && mid >= w.price);
        if (age <= this.cancelMs && !reached) {
          const last = this.events[this.events.length - 1];
          if (!last || last.price !== w.price || (now - last.ts) > this.eventLifeMs) {
            this.events.push({ price: w.price, side: w.side, ts: now });
          }
        }
        this.watch.delete(key);
      }
    }

    if (this.watch.size > 400) {
      const keys = [...this.watch.keys()].slice(0, 200);
      for (const k of keys) this.watch.delete(k);
    }
  }

  prune(now) { this.events = this.events.filter(e => (now - e.ts) < this.eventLifeMs); }

  clear() { this.watch.clear(); this.events = []; }
}
