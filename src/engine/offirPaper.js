/**
 * offirPaper.js — מעקב STRONG BUY וירטואלי (Paper Tracking) של +OFFIR (שלב 4-b).
 *
 * מדד ביצועים עצמי: כל מניה שקיבלה המלצת STRONG BUY (ממנוע ההמלצה של שלב 3)
 * "נקנית" וירטואלית ב-$100, ונמדדת ב-4 נקודות זמן כתשואה ממחיר הכניסה:
 *   D  — יום אחרי · W — שבוע אחרי · M — חודש אחרי · HIGH — כשחזרה לשיא שלפני ה-dip.
 *
 * שקוף לחלוטין — נבדק headless. **וירטואלי בלבד** (DEMO), לא עסקה אמיתית.
 * המדידות נתפסות קדימה: בכל רענון, אם עבר סף הזמן וטרם נתפס — נתפס המחיר הנוכחי.
 */

export const PAPER_AMOUNT = 100;      // $ סמלי לכל קנייה וירטואלית
const DAY = 86400000;

export const MARKS = [
  { key: 'D', ms: 1 * DAY,  label: 'D' },
  { key: 'W', ms: 7 * DAY,  label: 'W' },
  { key: 'M', ms: 30 * DAY, label: 'M' },
];

const up = (s) => String(s || '').toUpperCase();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** recordBuy — קונה מניה וירטואלית פעם אחת (לא כופל אם כבר מוחזקת). */
export function recordBuy(book, { ticker, price, localHigh = null, ts, label = '' }) {
  const b = book && book.positions ? book : { positions: {} };
  const t = up(ticker);
  const p = num(price);
  if (!t || p == null || p <= 0 || !Number.isFinite(ts)) return b;
  if (b.positions[t]) return b;                       // כבר נקנתה — לא כופלים
  return {
    ...b,
    positions: {
      ...b.positions,
      [t]: {
        ticker: t, label: label || t,
        entryPrice: p, entryTs: ts, qty: PAPER_AMOUNT / p,
        localHigh: num(localHigh),
        marks: {},            // { D, W, M } → תשואה % שנתפסה במועד
        high: null,           // תשואה % כשהמחיר חזר ל-localHigh
        virtual: true,
      },
    },
  };
}

/**
 * updateBook — תופס מדידות D/W/M כשעובר הסף, ו-HIGH כשהמחיר מגיע ל-localHigh.
 * @returns {{book, changed}} changed=true ⇒ צריך לשמור.
 */
export function updateBook(book, priceMap, now) {
  const b = book && book.positions ? book : { positions: {} };
  const positions = { ...b.positions };
  let changed = false;
  for (const t of Object.keys(positions)) {
    const pos = { ...positions[t], marks: { ...positions[t].marks } };
    const price = num(priceMap?.[t]);
    if (price != null) {
      const ret = ((price - pos.entryPrice) / pos.entryPrice) * 100;
      for (const m of MARKS) {
        if (pos.marks[m.key] == null && now >= pos.entryTs + m.ms) { pos.marks[m.key] = ret; changed = true; }
      }
      if (pos.high == null && pos.localHigh != null && price >= pos.localHigh) {
        pos.high = ((pos.localHigh - pos.entryPrice) / pos.entryPrice) * 100;
        changed = true;
      }
    }
    positions[t] = pos;
  }
  return { book: { ...b, positions }, changed };
}

/** liveReturn — תשואה חיה נוכחית (מחיר עכשיו מול הכניסה) — לציון/מיון הכפתורים. */
export function liveReturn(pos, currentPrice) {
  const p = num(currentPrice);
  if (!pos || p == null || !(pos.entryPrice > 0)) return null;
  return ((p - pos.entryPrice) / pos.entryPrice) * 100;
}

/** rankByLiveReturn — מחזיר מערך פוזיציות עם תשואה חיה, ממוין יורד (הגבוה ראשון). */
export function rankByLiveReturn(book, priceMap) {
  return Object.values(book?.positions || {})
    .map(pos => ({ pos, ret: liveReturn(pos, priceMap?.[pos.ticker]) }))
    .sort((a, b) => (b.ret ?? -1e9) - (a.ret ?? -1e9));
}

/** summarize — סיכום: כמה קריאות, אחוז מוצלחות (חי>0), תשואת HIGH ממוצעת. */
export function summarize(book, priceMap) {
  const positions = Object.values(book?.positions || {});
  const rets = positions.map(p => liveReturn(p, priceMap?.[p.ticker])).filter(r => r != null);
  const wins = rets.filter(r => r > 0).length;
  const highs = positions.map(p => p.high).filter(h => h != null);
  return {
    count: positions.length,
    graded: rets.length,
    winPct: rets.length ? (wins / rets.length) * 100 : null,
    avgHigh: highs.length ? highs.reduce((a, b) => a + b, 0) / highs.length : null,
  };
}
