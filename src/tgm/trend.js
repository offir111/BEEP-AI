// TGM · Trend Health — סיווג "מגמה שנתית" לכל ליד (משימה 3).
// ════════════════════════════════════════════════════════════════════════════
// המטרה: להבחין בין מניה *חזקה מעל המגמה השנתית שעשתה תיקון בריא ופורצת* (🟢)
// לבין מניה *שקרסה ומנסה להתאושש* (🔴 — נפילת סכין). הסיווג מבוסס נתוני מחיר של
// שנה אחורה (≈252 ימי מסחר), המגיעים דרך getDailySeries בשכבת dataLayer:
//   • LIVE — נרות אמיתיים (Yahoo /api/candles).
//   • MOCK — סדרה דטרמיניסטית סבירה; התג מסומן (MOCK) עד חיבור היסטוריה אמיתית.
//
// מחושב לכל מניה: SMA50, SMA200, תשואה שנתית, עומק תיקון מהשיא, מרחק מתחתית 52ש׳.
// ════════════════════════════════════════════════════════════════════════════

import { getDailySeries } from './data/dataLayer';

// ספי סיווג (מתועדים; ניתנים לכוונון).
export const TREND_CFG = {
  minAnnualReturnGreen: 10,   // תשואה שנתית > +10% (🟢)
  pullbackShallow: 5,         // עומק תיקון מינימלי (% מהשיא) ל"תיקון בריא"
  pullbackDeep: 25,           // עומק תיקון מקסימלי (% מהשיא) ל"תיקון בריא"
  crashAnnualReturn: -50,     // תשואה שנתית < −50% (🔴)
  deepBelowSma200Pct: -15,    // מחיר עמוק מתחת ל-SMA200 (🔴)
  nearLowPct: 30,             // "קרוב לתחתית 52ש׳" — תוך 30%
  crashFromHighPct: -70,      // ירידה 70%+ מהשיא (🔴, בשילוב קרבה לתחתית)
};

const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

/**
 * מסווג מגמה מתוך סדרת מגמה (פלט getDailySeries).
 * מחזיר { tier:'green'|'yellow'|'red'|'unknown', label, source, metrics }.
 */
export function classifyTrend(series) {
  if (!series || !Array.isArray(series.closes) || series.closes.length < 30) {
    return { tier: 'unknown', label: 'אין נתוני מגמה', source: series?.source || 'none', metrics: null };
  }
  const price = series.lastClose;
  const firstClose = series.closes[0];
  const { sma50, sma200, high52w, low52w } = series;

  const annualReturn = firstClose ? ((price - firstClose) / firstClose) * 100 : null;
  const drawdownFromHigh = high52w ? ((price - high52w) / high52w) * 100 : null; // ≤0
  const distFromLow = low52w ? ((price - low52w) / low52w) * 100 : null;          // ≥0
  const priceVsSma200 = sma200 ? ((price - sma200) / sma200) * 100 : null;

  const metrics = {
    price: r2(price),
    sma50: r2(sma50),
    sma200: r2(sma200),
    annualReturnPct: r2(annualReturn),
    drawdownFromHighPct: r2(drawdownFromHigh),
    distFromLowPct: r2(distFromLow),
    priceVsSma200Pct: r2(priceVsSma200),
    days: series.closes.length,
  };

  const C = TREND_CFG;

  // 🔴 מתאוששת מקריסה — סיכון גבוה (מספיק תנאי אחד):
  const crash =
    (annualReturn != null && annualReturn < C.crashAnnualReturn) ||
    (priceVsSma200 != null && priceVsSma200 < C.deepBelowSma200Pct) ||
    (distFromLow != null && drawdownFromHigh != null &&
      distFromLow <= C.nearLowPct && drawdownFromHigh <= C.crashFromHighPct);

  if (crash) {
    return { tier: 'red', label: 'מתאוששת מקריסה — סיכון גבוה', source: series.source, metrics };
  }

  // 🟢 מגמה שנתית עולה — תיקון בריא (כל התנאים):
  const healthyUptrend =
    sma200 != null && price > sma200 &&
    sma50 != null && sma200 != null && sma50 > sma200 &&
    annualReturn != null && annualReturn > C.minAnnualReturnGreen &&
    drawdownFromHigh != null && drawdownFromHigh <= -C.pullbackShallow && drawdownFromHigh >= -C.pullbackDeep;

  if (healthyUptrend) {
    return { tier: 'green', label: 'מגמה שנתית עולה — תיקון בריא', source: series.source, metrics };
  }

  // 🟡 ניטרלי / לא חד-משמעי
  return { tier: 'yellow', label: 'ניטרלי / לא חד-משמעי', source: series.source, metrics };
}

/** סיווג מגמה לליד לפי סימבול + תאריך הסיגנל. */
export function classifyLeadTrend(symbol, asOfMs) {
  const series = getDailySeries(symbol, asOfMs);
  return classifyTrend(series);
}

// תוויות UI קצרות + אימוג'י.
export const TREND_TIERS = {
  green: { emoji: '🟢', short: 'מגמה עולה' },
  yellow: { emoji: '🟡', short: 'ניטרלי' },
  red: { emoji: '🔴', short: 'מקריסה' },
  unknown: { emoji: '⚪', short: 'לא ידוע' },
};
