/**
 * MarketPulseEngine — a live scrolling feed of the notable real trades: large
 * prints and sweeps. Each row is an actual aggTrade with real price/qty/time.
 * A dynamic threshold (EMA of trade notional × multiplier) keeps it relevant
 * across symbols and regimes — small coins and BTC both surface their big hits.
 */
export default class MarketPulseEngine {
  constructor({ maxRows = 60, multiplier = 6 } = {}) {
    this.maxRows = maxRows;
    this.multiplier = multiplier;
    this.rows = [];          // { price, qty, notional, buy, ts, sweep }
    this._emaNotional = 0;
    this._n = 0;
  }

  addTrade(t, sweep = false) {
    const notional = t.price * t.qty;
    // Update EMA baseline of trade size.
    this._n++;
    const alpha = this._n < 50 ? 1 / this._n : 0.02;
    this._emaNotional = this._emaNotional + alpha * (notional - this._emaNotional);

    const big = notional > this._emaNotional * this.multiplier;
    if (!big && !sweep) return null;

    const row = {
      price: t.price,
      qty: t.qty,
      notional,
      buy: !t.buyerMaker,
      ts: t.ts,
      sweep,
    };
    this.rows.unshift(row);
    if (this.rows.length > this.maxRows) this.rows.pop();
    return row;
  }

  clear() { this.rows = []; this._emaNotional = 0; this._n = 0; }
}
