// TGM · Live Provider — שכבת נתונים אמיתית (LIVE) מבוססת Yahoo דרך /api/candles.
// ────────────────────────────────────────────────────────────────────────────
// שוכפל מהדפוס שכבר עובד ב-BEEP AI: כל משיכת ה-OHLC עוברת דרך פונקציית ה-Serverless
// `api/candles.js` (Yahoo v8 chart, query1→query2 fallback, interval=1d → range=1y).
// אנחנו לא ממציאים ארכיטקטורה חדשה — רק צורכים את אותו endpoint שכבר מגיש נרות לצ'ארטים.
//
// אחריות הקובץ: משיכה + cache בלבד. כל המתמטיקה (העשרה/מגמה/forward) ב-seriesMath.js,
// המשותף ל-LIVE ול-MOCK. כך אין שני מסלולי חישוב, והכול נבדק ב-Node.
// ────────────────────────────────────────────────────────────────────────────

import { apiUrl } from '../../utils/apiBase';

// cache: symbol → series (מערך נרות ממוין עולה), או null אם נכשל.
const _series = new Map();
let _loadedAt = 0;

export function hasSeries(symbol) {
  const s = _series.get(symbol);
  return Array.isArray(s) && s.length > 0;
}

export function liveSymbolCount() {
  let n = 0;
  for (const v of _series.values()) if (Array.isArray(v) && v.length) n++;
  return n;
}

export function lastLoadedAt() {
  return _loadedAt;
}

export function getSeries(symbol) {
  return _series.get(symbol) || null;
}

// ── משיכת סדרה בודדת דרך /api/candles ───────────────────────────────────────
async function fetchSeries(symbol) {
  const res = await fetch(apiUrl(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d`), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`candles ${res.status}`);
  const data = await res.json();
  const raw = Array.isArray(data?.candles) ? data.candles : [];
  // נרמול: {time(שניות),open,high,low,close,volume} → {t(ms),o,h,l,c,v,symbol}, ממוין עולה.
  return raw
    .map((c) => ({
      t: (Number(c.time) || 0) * 1000,
      o: Number(c.open), h: Number(c.high), l: Number(c.low), c: Number(c.close),
      v: Number(c.volume) || 0, symbol,
    }))
    .filter((b) => Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c) && b.t > 0)
    .sort((a, b) => a.t - b.t);
}

/**
 * טוען סדרות אמיתיות עבור רשימת סימבולים (throttled). מעדכן cache.
 * onProgress(done, total, symbol, ok). מחזיר { ok, fail, total }.
 */
export async function loadSeries(symbols, { concurrency = 4, onProgress } = {}) {
  const list = [...new Set(symbols)];
  let ok = 0, fail = 0, done = 0, cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const sym = list[cursor++];
      try {
        const s = await fetchSeries(sym);
        if (s.length >= 30) { _series.set(sym, s); ok++; }
        else { _series.set(sym, null); fail++; }
        done++;
        onProgress?.(done, list.length, sym, s.length >= 30);
      } catch {
        _series.set(sym, null); fail++; done++;
        onProgress?.(done, list.length, sym, false);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  _loadedAt = Date.now();
  return { ok, fail, total: list.length };
}

export function clearSeries() {
  _series.clear();
  _loadedAt = 0;
}
