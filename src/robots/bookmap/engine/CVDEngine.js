/**
 * CVDEngine — Cumulative Volume Delta from the real aggTrade stream.
 * delta per trade = aggressive-buy qty − aggressive-sell qty; accumulated.
 * Keeps a bounded series of { ts, v } so a panel can plot it on the chart's
 * time axis. Resets per session (symbol change / clear).
 */
export default class CVDEngine {
  constructor({ maxPoints = 5000 } = {}) {
    this.maxPoints = maxPoints;
    this.points = [];   // { ts, v }
    this.cum = 0;
  }

  addTrade(t) {
    this.cum += (!t.buyerMaker ? t.qty : -t.qty);   // buyerMaker=true → aggressive sell
    this.points.push({ ts: t.ts, v: this.cum });
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  clear() { this.points = []; this.cum = 0; }
}
