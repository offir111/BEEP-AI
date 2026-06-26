/**
 * BinanceTradesFeed — live aggregated trades for one symbol.
 *   wss://stream.binance.com:9443/ws/<sym>@aggTrade
 *
 * Each trade → onTrade({ price, qty, buyerMaker, ts }):
 *   buyerMaker === true  → the buyer was the maker → AGGRESSIVE SELL (red)
 *   buyerMaker === false → AGGRESSIVE BUY (green)
 *
 * Powers Volume Bubbles, Market Pulse and Iceberg/Stop detection.
 * Exponential-backoff reconnect. No synthetic trades — ever.
 */
const WS_HOST = 'wss://stream.binance.com:9443/ws';

export default class BinanceTradesFeed {
  constructor(symbol, { onTrade, onStatus } = {}) {
    this.symbol = symbol.toUpperCase();
    this.onTrade = onTrade || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.closed = false;
    this.retries = 0;
    this.reconnectTimer = null;
  }

  start() { this.closed = false; this._connect(); }

  _connect() {
    if (this.closed) return;
    this.onStatus('connecting');
    let ws;
    try {
      ws = new WebSocket(`${WS_HOST}/${this.symbol.toLowerCase()}@aggTrade`);
    } catch { this._scheduleReconnect(); return; }
    this.ws = ws;

    ws.onopen = () => { this.retries = 0; this.onStatus('live'); };
    ws.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.e !== 'aggTrade') return;
      this.onTrade({
        price: parseFloat(ev.p),
        qty: parseFloat(ev.q),
        buyerMaker: ev.m === true,   // true → aggressive sell
        ts: ev.T,
      });
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this.closed) return;
      this.onStatus('disconnected');
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this.closed) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 1000 * Math.pow(2, this.retries++));
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  stop() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }
}
