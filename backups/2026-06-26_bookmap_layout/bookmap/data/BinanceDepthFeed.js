/**
 * BinanceDepthFeed — maintains a live local order book for one symbol.
 *
 * Real-data pipeline (per Binance docs):
 *   1. Open  wss://stream.binance.com:9443/ws/<sym>@depth@100ms  and buffer events.
 *   2. GET   the REST depth snapshot (limit=5000) — via the app's Vercel proxy so a
 *            browser-side Binance/CORS block can't take us offline.
 *   3. Merge: drop buffered events with u <= snapshot.lastUpdateId, then apply the
 *            rest contiguously. If the sequence ever breaks → re-snapshot.
 *
 * The WebSocket connects DIRECTLY (no proxy needed for WS). Only the snapshot
 * goes through the proxy. Exponential-backoff reconnect on every drop.
 *
 * Callbacks:
 *   onUpdate(book)  — after each applied batch (book = OrderBookState)
 *   onRawDiff(ev)   — every raw diff event (for the recorder)
 *   onStatus(s)     — 'connecting' | 'live' | 'disconnected'
 */
import OrderBookState from './OrderBookState';
import { apiUrl } from '../../../utils/apiBase';

const WS_HOST = 'wss://stream.binance.com:9443/ws';

export default class BinanceDepthFeed {
  constructor(symbol, { onUpdate, onRawDiff, onStatus } = {}) {
    this.symbol = symbol.toUpperCase();
    this.onUpdate = onUpdate || (() => {});
    this.onRawDiff = onRawDiff || (() => {});
    this.onStatus = onStatus || (() => {});

    this.book = new OrderBookState();
    this.ws = null;
    this.buffer = [];
    this.synced = false;
    this.closed = false;
    this.retries = 0;
    this.reconnectTimer = null;
    this.snapshotInFlight = false;
  }

  start() {
    this.closed = false;
    this._connect();
  }

  _connect() {
    if (this.closed) return;
    this.onStatus('connecting');
    this.synced = false;
    this.buffer = [];
    const stream = `${this.symbol.toLowerCase()}@depth@100ms`;
    let ws;
    try {
      ws = new WebSocket(`${WS_HOST}/${stream}`);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      // Pull the snapshot only once the stream is flowing, so no events are missed.
      this._loadSnapshot();
    };

    ws.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.e !== 'depthUpdate') return;
      this.onRawDiff(ev);
      if (!this.synced) {
        this.buffer.push(ev);
        return;
      }
      const ok = this.book.applyDiff(ev);
      if (!ok) { this._resync(); return; }
      this.onUpdate(this.book);
    };

    ws.onerror = () => { /* close handler does the work */ };
    ws.onclose = () => {
      if (this.closed) return;
      this.onStatus('disconnected');
      this._scheduleReconnect();
    };
  }

  async _loadSnapshot() {
    if (this.snapshotInFlight) return;
    this.snapshotInFlight = true;
    try {
      const url = apiUrl(`/api/binance?ep=depth&symbol=${this.symbol}&limit=5000`);
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error('snapshot ' + r.status);
      const snap = await r.json();
      if (this.closed) return;
      if (!snap || !Array.isArray(snap.bids)) throw new Error('bad snapshot');

      this.book.applySnapshot(snap);
      // Drain buffered events: drop fully-stale, apply the rest in order.
      const pending = this.buffer.filter(ev => ev.u > snap.lastUpdateId);
      this.buffer = [];
      let broke = false;
      for (const ev of pending) {
        if (!this.book.applyDiff(ev)) { broke = true; break; }
      }
      if (broke) { this.snapshotInFlight = false; this._resync(); return; }

      this.synced = true;
      this.snapshotInFlight = false;
      this.onStatus('live');
      this.onUpdate(this.book);
    } catch {
      this.snapshotInFlight = false;
      if (this.closed) return;
      // Retry the snapshot shortly; keep buffering meanwhile.
      this.reconnectTimer = setTimeout(() => this._loadSnapshot(), 1500);
    }
  }

  /** Sequence broke → re-pull a fresh snapshot without tearing down the socket. */
  _resync() {
    this.synced = false;
    this.buffer = [];
    this.book.clear();
    this.onStatus('connecting');
    this._loadSnapshot();
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
    this.book.clear();
  }
}
