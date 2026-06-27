/**
 * VWAPEngine — session Volume-Weighted Average Price from the real trade stream.
 * vwap = Σ(price·qty) / Σ(qty). Keeps a bounded {ts, v} series so the chart can
 * draw VWAP as a line over time. Resets per session (symbol change / clear).
 */
export default class VWAPEngine {
  constructor({ maxPoints = 4000 } = {}) {
    this.maxPoints = maxPoints;
    this.sumPV = 0;
    this.sumV = 0;
    this.vwap = null;
    this.points = [];   // { ts, v }
  }

  addTrade(t) {
    this.sumPV += t.price * t.qty;
    this.sumV += t.qty;
    this.vwap = this.sumV > 0 ? this.sumPV / this.sumV : null;
    if (this.vwap != null) {
      this.points.push({ ts: t.ts, v: this.vwap });
      if (this.points.length > this.maxPoints) this.points.shift();
    }
  }

  clear() { this.sumPV = 0; this.sumV = 0; this.vwap = null; this.points = []; }
}
