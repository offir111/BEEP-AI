/**
 * VolumeProfileEngine — keeps a rolling buffer of recent real aggTrades so a
 * vertical Volume Profile (traded volume per price level, split buy/sell) can be
 * binned to whatever price range is currently visible. Buffer is bounded.
 */
export default class VolumeProfileEngine {
  constructor({ max = 8000 } = {}) {
    this.max = max;
    this.trades = [];   // { price, qty, buy }
  }

  addTrade(t) {
    this.trades.push({ price: t.price, qty: t.qty, buy: !t.buyerMaker });
    if (this.trades.length > this.max) this.trades.shift();
  }

  /** Bin into `rows` buckets across [pMin,pMax]: returns {buy,sell,max}. */
  profile(pMin, pMax, rows) {
    const buy = new Float32Array(rows);
    const sell = new Float32Array(rows);
    let max = 0;
    if (pMax > pMin) {
      const span = pMax - pMin;
      for (const t of this.trades) {
        if (t.price < pMin || t.price > pMax) continue;
        const r = Math.min(rows - 1, Math.floor((pMax - t.price) / span * rows));
        if (t.buy) buy[r] += t.qty; else sell[r] += t.qty;
        const tot = buy[r] + sell[r];
        if (tot > max) max = tot;
      }
    }
    return { buy, sell, max };
  }

  clear() { this.trades = []; }
}
