/**
 * LargeLotEngine — tracks the biggest real trades (notional above a dynamic
 * threshold = EMA × factor). Keeps a bounded recent list so the chart can put a
 * glowing halo + a price-axis arrow on each. Pure real data.
 */
export default class LargeLotEngine {
  constructor({ factor = 8, max = 50, lifeMs = 20000 } = {}) {
    this.factor = factor;
    this.max = max;
    this.lifeMs = lifeMs;
    this.lots = [];        // { price, qty, notional, buy, ts }
    this.maxNotional = 0;
    this._ema = 0;
    this._n = 0;
  }

  addTrade(t) {
    const notional = t.price * t.qty;
    this._n++;
    const a = this._n < 50 ? 1 / this._n : 0.02;
    this._ema += a * (notional - this._ema);
    if (this._n > 40 && notional > this._ema * this.factor) {
      this.lots.push({ price: t.price, qty: t.qty, notional, buy: !t.buyerMaker, ts: t.ts });
      if (notional > this.maxNotional) this.maxNotional = notional;
      if (this.lots.length > this.max) this.lots.shift();
    }
  }

  prune(now) {
    const cutoff = now - this.lifeMs;
    while (this.lots.length && this.lots[0].ts < cutoff) this.lots.shift();
    this.maxNotional *= 0.999;
  }

  clear() { this.lots = []; this.maxNotional = 0; this._ema = 0; this._n = 0; }
}
