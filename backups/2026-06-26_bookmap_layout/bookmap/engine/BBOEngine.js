/**
 * BBOEngine — rolling history of best bid / best offer (from @bookTicker) plus
 * an absorption detector: when large volume trades at the touch but price does
 * NOT move, a passive order is absorbing it. We track cumulative volume that
 * executes at a stationary best price and flag it.
 */
export default class BBOEngine {
  constructor({ maxPoints = 600 } = {}) {
    this.maxPoints = maxPoints;
    this.points = [];       // { bid, ask, ts }
    this.last = null;
    // absorption tracking
    this._absVol = 0;
    this._absPrice = null;
    this.absorption = null; // { price, vol, side, ts } when detected
  }

  addBBO(b) {
    this.last = b;
    this.points.push({ bid: b.bidPrice, ask: b.askPrice, ts: b.ts });
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  /** Feed trades to accumulate absorption at a static touch price. */
  addTrade(t) {
    if (!this.last) return;
    const atBid = Math.abs(t.price - this.last.bidPrice) < 1e-9;
    const atAsk = Math.abs(t.price - this.last.askPrice) < 1e-9;
    if (!atBid && !atAsk) { this._reset(); return; }
    const touch = atBid ? this.last.bidPrice : this.last.askPrice;
    if (this._absPrice !== touch) { this._absPrice = touch; this._absVol = 0; }
    this._absVol += t.qty * t.price;   // quote volume absorbed
    // Threshold scales with price so it's meaningful across symbols.
    const thresh = touch * 5;          // ~5 units of base notional at the touch
    if (this._absVol > thresh) {
      this.absorption = { price: touch, vol: this._absVol, side: atBid ? 'bid' : 'ask', ts: t.ts };
    }
  }

  _reset() { this._absVol = 0; this._absPrice = null; }

  spread() {
    if (!this.last) return null;
    return this.last.askPrice - this.last.bidPrice;
  }

  clear() {
    this.points = [];
    this.last = null;
    this.absorption = null;
    this._reset();
  }
}
