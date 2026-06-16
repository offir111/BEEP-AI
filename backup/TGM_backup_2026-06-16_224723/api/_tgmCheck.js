/**
 * TGM — בדיקת לידים מול Binance בצד-שרת (זהה ללוגיקה בלקוח, ל-cron בענן).
 * כללים: TP=ניצחון / SL=הפסד, SL ראשון אם שניהם באותו נר, חלון 14 יום ואז מחיר נוכחי,
 * וליד טרי שטרם הוכרע נשאר 'open'.
 */

const BINANCE_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
export const CHECK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function toBinanceSymbol(asset) {
  return String(asset || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function fetchKlines(symbol, startMs, endMs) {
  const path = `/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${startMs}&endTime=${endMs}&limit=1000`;
  let lastErr = null;
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(host + path, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { lastErr = new Error(`Binance ${res.status}`); continue; }
      const data = await res.json();
      if (Array.isArray(data)) return data;
      lastErr = new Error('bad response');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Binance fetch failed');
}

// lead: { asset, direction, entry, tp, sl, dateMs }
// → { result:'win'|'loss'|'open', reason, exitPrice, closedAtMs }
export async function checkLead(lead) {
  const symbol = toBinanceSymbol(lead.asset);
  const entry = Number(lead.entry), tp = Number(lead.tp), sl = Number(lead.sl);
  const startMs = Number(lead.dateMs);
  const now = Date.now();
  const endMs = Math.min(now, startMs + CHECK_WINDOW_MS);
  if (!symbol || !Number.isFinite(entry) || !Number.isFinite(tp) || !Number.isFinite(sl) || !Number.isFinite(startMs)) {
    throw new Error('invalid lead');
  }

  const klines = await fetchKlines(symbol, startMs, endMs);
  if (!klines.length) throw new Error(`no price data for ${symbol}`);

  const isLong = lead.direction === 'LONG';
  for (const k of klines) {
    const high = parseFloat(k[2]), low = parseFloat(k[3]), openTime = k[0];
    const slHit = isLong ? low <= sl : high >= sl;
    const tpHit = isLong ? high >= tp : low <= tp;
    if (slHit) return { result: 'loss', reason: 'SL', exitPrice: sl, closedAtMs: openTime };
    if (tpHit) return { result: 'win', reason: 'TP', exitPrice: tp, closedAtMs: openTime };
  }

  const last = klines[klines.length - 1];
  const cur = parseFloat(last[4]);
  const fullWindowElapsed = startMs + CHECK_WINDOW_MS <= now;
  if (!fullWindowElapsed) return { result: 'open', reason: 'OPEN', exitPrice: cur, closedAtMs: last[0] };
  const win = isLong ? cur >= entry : cur <= entry;
  return { result: win ? 'win' : 'loss', reason: 'TIME', exitPrice: cur, closedAtMs: last[0] };
}
