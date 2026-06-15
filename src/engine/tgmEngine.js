// TGM — מנוע בדיקה אוטומטי מול Binance API.
// לכל ליד: מושך נרות 1 שעה מתאריך הכניסה, וקובע אם נגע TP (ניצחון) או SL (הפסד) קודם.
// כללים:
//   • אם גם TP וגם SL נמצאים באותו נר — מניחים SL ראשון (שמרני) → הפסד.
//   • אם אף יעד לא נגע תוך 14 יום — סוגרים לפי מחיר הסגירה הנוכחי (win/loss לפי כיוון).

import { CHECK_WINDOW_MS } from './tgmProviders';

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision', // נקודת קצה ציבורית לנתוני שוק (גיבוי, ידידותית ל-CORS)
];

// "BTC/USDT" → "BTCUSDT"
export function toBinanceSymbol(asset) {
  return String(asset || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// משיכת נרות 1h בטווח [startMs, endMs] עם גיבוי בין נקודות הקצה.
async function fetchKlines(symbol, startMs, endMs) {
  const interval = '1h';
  const limit = 1000; // 14 יום * 24 = 336 נרות — מתחת לתקרה, בקשה אחת מספיקה
  const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=${limit}`;

  let lastErr = null;
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(host + path);
      if (!res.ok) {
        lastErr = new Error(`Binance ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        lastErr = new Error('תשובה לא תקינה מ-Binance');
        continue;
      }
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('כשל בתקשורת מול Binance');
}

// מבנה נר Binance: [openTime, open, high, low, close, volume, closeTime, ...]
function candleHL(k) {
  return { high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), openTime: k[0] };
}

/**
 * בדיקת ליד בודד.
 * lead: { asset, direction: 'LONG'|'SHORT', entry, tp, sl, dateMs }
 * מחזיר: { result: 'win'|'loss', reason: 'TP'|'SL'|'TIME', exitPrice, closedAtMs, candles }
 */
export async function checkLead(lead) {
  const symbol = toBinanceSymbol(lead.asset);
  const entry = Number(lead.entry);
  const tp = Number(lead.tp);
  const sl = Number(lead.sl);
  const startMs = Number(lead.dateMs);
  const now = Date.now();
  const endMs = Math.min(now, startMs + CHECK_WINDOW_MS);

  if (!symbol) throw new Error('נכס לא תקין');
  if (!Number.isFinite(entry) || !Number.isFinite(tp) || !Number.isFinite(sl)) {
    throw new Error('ערכי מחיר לא תקינים');
  }
  if (!Number.isFinite(startMs)) throw new Error('תאריך לא תקין');

  const klines = await fetchKlines(symbol, startMs, endMs);

  if (!klines.length) {
    throw new Error(`לא נמצאו נתוני מחיר עבור ${symbol}`);
  }

  const isLong = lead.direction === 'LONG';

  for (const k of klines) {
    const { high, low, openTime } = candleHL(k);

    // בדיקה שמרנית: SL נבדק ראשון. אם גם TP וגם SL באותו נר → מניחים SL.
    const slHit = isLong ? low <= sl : high >= sl;
    const tpHit = isLong ? high >= tp : low <= tp;

    if (slHit) {
      return { result: 'loss', reason: 'SL', exitPrice: sl, closedAtMs: openTime, candles: klines.length };
    }
    if (tpHit) {
      return { result: 'win', reason: 'TP', exitPrice: tp, closedAtMs: openTime, candles: klines.length };
    }
  }

  // אף יעד לא נגע תוך החלון — סגירה לפי מחיר נוכחי (סגירת הנר האחרון).
  const last = candleHL(klines[klines.length - 1]);
  const cur = last.close;
  const win = isLong ? cur >= entry : cur <= entry;
  return {
    result: win ? 'win' : 'loss',
    reason: 'TIME',
    exitPrice: cur,
    closedAtMs: last.openTime,
    candles: klines.length,
  };
}

/**
 * מחיר פתיחה היסטורי בנקודת זמן — לזריעת נתוני דמו ריאליסטיים.
 * מחזיר את open של נר ה-1h המכיל את הזמן הנתון.
 */
export async function getOpenPriceAt(asset, ms) {
  const symbol = toBinanceSymbol(asset);
  const klines = await fetchKlines(symbol, ms, ms + 60 * 60 * 1000);
  if (!klines.length) throw new Error(`אין נתון מחיר עבור ${symbol}`);
  return parseFloat(klines[0][1]);
}
