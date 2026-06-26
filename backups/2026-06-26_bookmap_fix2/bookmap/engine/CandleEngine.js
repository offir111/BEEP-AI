/**
 * CandleEngine — builds OHLC candles from real aggTrades in a short timeframe
 * (default 2s, smooth on Binance flow). Each candle aggregates the trades whose
 * timestamp falls in [bucket, bucket+tf). Pure real data — no synthesis.
 */
export default class CandleEngine {
  constructor({ tf = 2000, max = 240 } = {}) {
    this.tf = tf;
    this.max = max;
    this.candles = [];      // { t, o, h, l, c, vol }
  }

  addTrade(t) {
    const bucket = Math.floor(t.ts / this.tf) * this.tf;
    let last = this.candles[this.candles.length - 1];
    if (!last || last.t !== bucket) {
      last = { t: bucket, o: t.price, h: t.price, l: t.price, c: t.price, vol: 0 };
      this.candles.push(last);
      if (this.candles.length > this.max) this.candles.shift();
    }
    if (t.price > last.h) last.h = t.price;
    if (t.price < last.l) last.l = t.price;
    last.c = t.price;
    last.vol += t.qty;
  }

  clear() { this.candles = []; }
}
