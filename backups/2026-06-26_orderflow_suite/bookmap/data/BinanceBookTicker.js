/**
 * BinanceBookTicker — real-time best bid / best offer for one symbol.
 *   wss://stream.binance.com:9443/ws/<sym>@bookTicker
 *
 * onBBO({ bidPrice, bidQty, askPrice, askQty, ts }) — the exact top of book.
 * Feeds the BBO ribbon and the live spread readout. Reconnects with backoff.
 */
const WS_HOST = 'wss://stream.binance.com:9443/ws';

export default class BinanceBookTicker {
  constructor(symbol, { onBBO, onStatus } = {}) {
    this.symbol = symbol.toUpperCase();
    this.onBBO = onBBO || (() => {});
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
      ws = new WebSocket(`${WS_HOST}/${this.symbol.toLowerCase()}@bookTicker`);
    } catch { this._scheduleReconnect(); return; }
    this.ws = ws;

    ws.onopen = () => { this.retries = 0; this.onStatus('live'); };
    ws.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.b == null || ev.a == null) return;
      this.onBBO({
        bidPrice: parseFloat(ev.b),
        bidQty: parseFloat(ev.B),
        askPrice: parseFloat(ev.a),
        askQty: parseFloat(ev.A),
        ts: Date.now(),
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
