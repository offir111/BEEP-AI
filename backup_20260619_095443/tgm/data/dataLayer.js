// TGM · Data Layer — שכבת נתונים מופשטת אחת לכל המנועים.
// ────────────────────────────────────────────────────────────────────────────
// כל המנועים והמעריך (evaluator) צורכים נתונים אך ורק דרך הקובץ הזה.
// כדי להחליף ספק נתונים — משנים רק את ה-PROVIDER כאן, בלי לגעת באף מנוע.
//
// הספק הנוכחי: MOCK דטרמיניסטי (mockMarketData.js).
// TODO(real-data): לממש PROVIDER אמיתי מול אחד מאלה ולהציב אותו כאן:
//   • Polygon.io   — GET /v2/aggs/ticker/{sym}/range/1/day/{from}/{to}
//   • Alpha Vantage— TIME_SERIES_DAILY (חינמי, מוגבל ל-25 בקשות/יום)
//   • Finnhub      — GET /stock/candle?symbol=..&resolution=D
//   הממשק שצריך לספק: getUniverse / getDailyBar / getEvents (חתימות למטה).
// ────────────────────────────────────────────────────────────────────────────

import {
  MOCK_UNIVERSE,
  mockDailyBar,
  mockCatalysts,
  mockMnaEvents,
} from './mockMarketData';

// ── מסנני יקום (חברות אמיתיות בלבד) ─────────────────────────────────────────
export const UNIVERSE_FILTERS = {
  minMarketCapM: 500,   // שווי שוק > 500M
  minPrice: 3,          // מחיר > $3
  minAvgVolM: 1,        // נפח ממוצע > 1M מניות/יום
};

export function passesUniverse(stock) {
  return (
    stock.marketCapM > UNIVERSE_FILTERS.minMarketCapM &&
    stock.price > UNIVERSE_FILTERS.minPrice &&
    stock.avgVolM > UNIVERSE_FILTERS.minAvgVolM
  );
}

// ── הספק הפעיל (נקודת ההחלפה היחידה) ───────────────────────────────────────
const mockProvider = {
  name: 'mock',
  getUniverse() {
    return MOCK_UNIVERSE;
  },
  getDailyBar(symbol, dateMs) {
    const stock = MOCK_UNIVERSE.find((s) => s.symbol === symbol);
    if (!stock) return null;
    return mockDailyBar(stock, dateMs);
  },
  // מחיר היציאה (סוף יום) — נמשך בנפרד מהסיגנל. מדמה חור נתונים אמיתי:
  // מניות עם thinData לעיתים אינן מחזירות מחיר יציאה (~רבע מהימים), כך שהליד
  // נשאר ללא הכרעה ומסומן "שגיאה" — בדיוק התרחיש שמאמת את תיקון ה-win-rate.
  getExitBar(symbol, dateMs) {
    const stock = MOCK_UNIVERSE.find((s) => s.symbol === symbol);
    if (!stock) return null;
    if (stock.thinData) {
      const gapSeed = Math.floor(dateMs / 86400000);
      if (gapSeed % 4 === 0) return null; // ~רבע מהימים אין מחיר יציאה
    }
    return mockDailyBar(stock, dateMs);
  },
  getCatalysts(dateMs) {
    return mockCatalysts(dateMs);
  },
  getMnaEvents(dateMs) {
    return mockMnaEvents(dateMs);
  },
};

// להחלפת ספק: const PROVIDER = polygonProvider; (כל עוד הוא מממש את אותו ממשק)
const PROVIDER = mockProvider;

export const dataProviderName = PROVIDER.name;

// ── ה-API הציבורי שכל המנועים משתמשים בו ───────────────────────────────────

/** יקום המניות המלא (לפני מסנן). */
export function getUniverse() {
  return PROVIDER.getUniverse();
}

/** יקום המניות שעובר את מסנני החברות האמיתיות בלבד. */
export function getFilteredUniverse() {
  return PROVIDER.getUniverse().filter(passesUniverse);
}

/**
 * נר יומי לסימבול בתאריך נתון, או null אם אין נתון (חור ב-API).
 * { open, high, low, close, prevClose, volume, changePct, atrPct, relVolume, high52w, resistance }
 */
export function getDailyBar(symbol, dateMs) {
  return PROVIDER.getDailyBar(symbol, dateMs);
}

/**
 * נר היציאה (סוף יום) — נמשך בנפרד מהסיגנל, ועשוי להחזיר null (חור ב-API).
 * משמש את המעריך בלבד; null → הליד מסומן "שגיאה" (לא הוכרע).
 */
export function getExitBar(symbol, dateMs) {
  return PROVIDER.getExitBar(symbol, dateMs);
}

/** אירועי קטליסט ליום (8-K / 13D / חוזים / השקעות). */
export function getCatalysts(dateMs) {
  return PROVIDER.getCatalysts(dateMs);
}

/** אירועי M&A ליום (שמועות/הכרזות מיזוג ורכישה). */
export function getMnaEvents(dateMs) {
  return PROVIDER.getMnaEvents(dateMs);
}
