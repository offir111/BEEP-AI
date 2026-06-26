/**
 * OrderBookState — a full local L2 order book for one symbol, maintained exactly
 * per Binance's "How to manage a local order book correctly" guide.
 *
 *   bids / asks are Map<priceString, qty(number)>.
 *   A qty of 0 in a diff event means "remove this price level".
 *
 * This is the single source of truth for the Heatmap and the DOM panel.
 * Everything drawn on screen comes from here — no synthetic data, ever.
 */
export default class OrderBookState {
  constructor() {
    this.bids = new Map();        // priceStr -> qty
    this.asks = new Map();        // priceStr -> qty
    this.lastUpdateId = 0;        // from the REST snapshot
    this.lastTs = 0;              // wall-clock ms of last applied update
    this.ready = false;           // snapshot applied + buffer drained
  }

  /** Load the REST snapshot (api/v3/depth). Replaces the whole book. */
  applySnapshot(snapshot) {
    this.bids.clear();
    this.asks.clear();
    for (const [p, q] of snapshot.bids) {
      const qty = parseFloat(q);
      if (qty > 0) this.bids.set(p, qty);
    }
    for (const [p, q] of snapshot.asks) {
      const qty = parseFloat(q);
      if (qty > 0) this.asks.set(p, qty);
    }
    this.lastUpdateId = snapshot.lastUpdateId;
    this.lastTs = Date.now();
    this.ready = true;
  }

  /**
   * Apply one diff-depth event ({U, u, b, a}). Returns true if applied,
   * false if the sequence broke (caller must re-snapshot).
   */
  applyDiff(ev) {
    // Drop stale events fully behind the snapshot.
    if (ev.u <= this.lastUpdateId) return true;
    // First event after a snapshot must straddle lastUpdateId+1.
    // Subsequent events must be perfectly contiguous.
    if (ev.U > this.lastUpdateId + 1) return false;  // gap → resync

    for (const [p, q] of ev.b) this._setLevel(this.bids, p, q);
    for (const [p, q] of ev.a) this._setLevel(this.asks, p, q);

    this.lastUpdateId = ev.u;
    this.lastTs = Date.now();
    return true;
  }

  _setLevel(side, priceStr, qtyStr) {
    const qty = parseFloat(qtyStr);
    if (qty === 0) side.delete(priceStr);
    else side.set(priceStr, qty);
  }

  /** Best bid / best ask straight from the book (numbers) or null. */
  bestBid() { return this._bestOf(this.bids, true); }
  bestAsk() { return this._bestOf(this.asks, false); }

  _bestOf(side, wantMax) {
    let best = null;
    for (const p of side.keys()) {
      const price = parseFloat(p);
      if (best === null || (wantMax ? price > best : price < best)) best = price;
    }
    return best;
  }

  mid() {
    const b = this.bestBid(), a = this.bestAsk();
    if (b == null || a == null) return null;
    return (b + a) / 2;
  }

  /**
   * Snapshot of levels within [pMin, pMax] as flat arrays for binning/rendering.
   * Returns { bids:[{price,qty}], asks:[{price,qty}] } sorted by price desc/asc.
   */
  levelsInRange(pMin, pMax) {
    const bids = [], asks = [];
    for (const [p, q] of this.bids) {
      const price = parseFloat(p);
      if (price >= pMin && price <= pMax) bids.push({ price, qty: q });
    }
    for (const [p, q] of this.asks) {
      const price = parseFloat(p);
      if (price >= pMin && price <= pMax) asks.push({ price, qty: q });
    }
    bids.sort((x, y) => y.price - x.price);   // high → low
    asks.sort((x, y) => x.price - y.price);   // low → high
    return { bids, asks };
  }

  /** Top-N levels each side for the DOM panel. */
  topLevels(n = 25) {
    const bids = [], asks = [];
    for (const [p, q] of this.bids) bids.push({ price: parseFloat(p), qty: q });
    for (const [p, q] of this.asks) asks.push({ price: parseFloat(p), qty: q });
    bids.sort((x, y) => y.price - x.price);
    asks.sort((x, y) => x.price - y.price);
    return { bids: bids.slice(0, n), asks: asks.slice(0, n) };
  }

  isStale(maxAgeMs = 5000) {
    return !this.ready || (Date.now() - this.lastTs) > maxAgeMs;
  }

  clear() {
    this.bids.clear();
    this.asks.clear();
    this.lastUpdateId = 0;
    this.lastTs = 0;
    this.ready = false;
  }
}
