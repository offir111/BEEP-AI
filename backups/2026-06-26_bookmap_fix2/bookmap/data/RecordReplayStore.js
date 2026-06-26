/**
 * RecordReplayStore — records the REAL live tick stream (depth diffs, trades,
 * bookTicker) to IndexedDB with timestamps, then replays exactly what happened.
 *
 * Nothing here is synthetic: replay only ever returns ticks that were actually
 * captured from Binance. A rolling cap keeps the buffer bounded.
 *
 * Tick shape: { kind:'depth'|'trade'|'bbo', ts:Number, data:Object }
 */
const DB_NAME = 'beepai_bookmap_replay';
const STORE = 'ticks';
const MAX_TICKS = 60000;          // rolling cap (~ a few minutes of busy book)

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export default class RecordReplayStore {
  constructor() {
    this.db = null;
    this.recording = false;
    this._queue = [];
    this._flushTimer = null;
    this._count = 0;
  }

  async init() {
    if (!('indexedDB' in window)) return false;
    try { this.db = await openDb(); return true; }
    catch { this.db = null; return false; }
  }

  async start() {
    if (!this.db) { const ok = await this.init(); if (!ok) return false; }
    await this.clear();
    this.recording = true;
    this._count = 0;
    return true;
  }

  stop() {
    this.recording = false;
    this._flush();
  }

  /** Push one real tick. Buffered then flushed in batches for performance. */
  push(kind, ts, data) {
    if (!this.recording || !this.db) return;
    this._queue.push({ kind, ts, data });
    this._count++;
    if (this._count > MAX_TICKS) this._trim();
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), 400);
    }
  }

  _flush() {
    clearTimeout(this._flushTimer);
    this._flushTimer = null;
    if (!this.db || this._queue.length === 0) return;
    const batch = this._queue;
    this._queue = [];
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      for (const t of batch) os.add(t);
    } catch { /* ignore — recording is best-effort */ }
  }

  _trim() {
    // Drop the oldest ~10% to keep the buffer bounded.
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      let removed = 0;
      const target = Math.floor(MAX_TICKS * 0.1);
      const cur = os.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c && removed < target) { c.delete(); removed++; c.continue(); }
      };
      this._count -= target;
    } catch { /* ignore */ }
  }

  async clear() {
    if (!this.db) return;
    await new Promise((res) => {
      try {
        const tx = this.db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      } catch { res(); }
    });
    this._count = 0;
  }

  /** Load every recorded tick, ordered by capture sequence. */
  async loadAll() {
    if (!this.db) return [];
    this._flush();
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => res((req.result || []).sort((a, b) => a.seq - b.seq));
        req.onerror = () => res([]);
      } catch { res([]); }
    });
  }

  async count() {
    if (!this.db) return 0;
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).count();
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => res(0);
      } catch { res(0); }
    });
  }
}
