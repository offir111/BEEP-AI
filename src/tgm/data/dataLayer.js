// TGM · Data Layer — שכבת נתונים מופשטת אחת לכל המנועים והמעריך.
// ────────────────────────────────────────────────────────────────────────────
// כל המנועים והמעריך צורכים נתונים אך ורק דרך הקובץ הזה. שתי שכבות מקור:
//   • LIVE — נרות אמיתיים מ-Yahoo דרך /api/candles (liveProvider.js). הדפוס שכבר
//            עובד ב-BEEP AI; אנו רק מושכים אותו לתוך TGM (משימה 0 — שכפול, לא בנייה).
//   • MOCK — סדרה דטרמיניסטית (mockMarketData.js → mockSeries) כשאין נתון אמיתי.
//
// שתי השכבות מייצרות series זהה ({t,o,h,l,c,v}) ומועשרות דרך אותו seriesMath.js,
// כך שאין שני מסלולי חישוב. לכל נר מצורף `_source: 'live' | 'mock'` — שקיפות מלאה.
//
// loadLiveData() (אסינכרוני) מושך נרות אמיתיים ל-cache; משם והלאה כל הקריאות
// סינכרוניות (כפי שהמנועים מצפים). סימבול שלא נמשך בהצלחה → נופל ל-MOCK ומסומן DEMO.
// ────────────────────────────────────────────────────────────────────────────

import { MOCK_UNIVERSE, mockSeries, mockCatalysts, mockMnaEvents } from './mockMarketData';
import * as live from './liveProvider';
import { enrichBar, trendWindow, forwardSlice, indexForDay, indexAsOf, YEAR_DAYS } from './seriesMath';

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

// ── עוגן זמן לסדרות MOCK (יציב לכל הסשן; ניתן לדריסה בבדיקות) ─────────────────
let _mockAnchorMs = Date.now();
export function setMockAnchor(ms) { _mockAnchorMs = ms; _mockSeriesCache.clear(); }

// cache לסדרות MOCK (symbol → series), נבנה lazy מול העוגן.
const _mockSeriesCache = new Map();
const MOCK_SERIES_DAYS = 320; // מספיק ל-252 ימי מגמה + חלון seed

function mockSeriesFor(symbol) {
  if (_mockSeriesCache.has(symbol)) return _mockSeriesCache.get(symbol);
  const stock = MOCK_UNIVERSE.find((s) => s.symbol === symbol);
  const s = stock ? mockSeries(stock, _mockAnchorMs, MOCK_SERIES_DAYS) : null;
  _mockSeriesCache.set(symbol, s);
  return s;
}

// ── בחירת מקור הסדרה לסימבול: LIVE אם נטען, אחרת MOCK ───────────────────────
function seriesFor(symbol) {
  if (live.hasSeries(symbol)) return { series: live.getSeries(symbol), source: 'live' };
  const ms = mockSeriesFor(symbol);
  return ms ? { series: ms, source: 'mock' } : { series: null, source: 'none' };
}

// ── מצב מקור הנתונים הכולל (לחיווי בכותרת) ───────────────────────────────────
// 'live'    — כל היקום נטען חי
// 'partial' — חלק חי, חלק MOCK
// 'mock'    — שום דבר לא נטען חי (דמו מלא)
export function dataMode() {
  const total = getFilteredUniverse().length; // טוענים חי רק את היקום המסונן
  const liveN = live.liveSymbolCount();
  if (liveN === 0) return 'mock';
  if (liveN >= total) return 'live';
  return 'partial';
}
export const dataProviderName = 'tgm-data-layer';
export function liveStats() {
  return { liveSymbols: live.liveSymbolCount(), total: getFilteredUniverse().length, loadedAt: live.lastLoadedAt() };
}

/**
 * טוען נתונים חיים (אסינכרוני) לכל היקום המסונן. שכפול הדפוס מ-BEEP AI: כל סימבול
 * דרך /api/candles. אחרי קריאה זו getDailyBar/getDailySeries/forwardBars מחזירים LIVE.
 */
export async function loadLiveData(opts = {}) {
  const symbols = getFilteredUniverse().map((s) => s.symbol);
  return live.loadSeries(symbols, opts);
}
export function clearLiveData() { live.clearSeries(); }

// ── ה-API הציבורי שכל המנועים משתמשים בו ───────────────────────────────────

export function getUniverse() { return MOCK_UNIVERSE; }
export function getFilteredUniverse() { return MOCK_UNIVERSE.filter(passesUniverse); }

/**
 * נר יומי מועשר לסימבול בתאריך נתון, או null אם אין נתון לאותו יום (יום לא-מסחר/חור).
 * { open,high,low,close,prevClose,volume,changePct,atrPct,relVolume,high52w,resistance,sma50,sma200,_source }
 */
export function getDailyBar(symbol, dateMs) {
  const { series, source } = seriesFor(symbol);
  if (!series) return null;
  const idx = indexForDay(series, dateMs);
  if (idx < 1) return null;
  return enrichBar(series, idx, source);
}

/** מקור הנתון לסימבול ('live' / 'mock' / 'none') — לשקיפות בתצוגה. */
export function barSource(symbol) {
  return seriesFor(symbol).source;
}

/**
 * סדרת מגמה שנתית לסימבול נכון ל-asOfMs (≈252 נרות): closes/highs/lows + ממוצעים נעים
 * + שיא/שפל 52ש׳. כולל { source: 'live'|'mock' }. null אם אין סדרה.
 */
export function getDailySeries(symbol, asOfMs) {
  const { series, source } = seriesFor(symbol);
  if (!series) return null;
  let endIdx = indexForDay(series, asOfMs);
  if (endIdx < 0) endIdx = indexAsOf(series, asOfMs);
  if (endIdx < 0) return null;
  const w = trendWindow(series, endIdx, YEAR_DAYS);
  return w ? { ...w, source } : null;
}

/**
 * נרות יציאה קדימה (forward window) — עד `days` ימי מסחר *אחרי* יום הסיגנל.
 * מחזיר { bars:[{t,o,h,l,c,v}], source }. ריק אם אין נתון/אין ימים אחרי (ליד "טרי").
 */
export function getForwardBars(symbol, signalDateMs, days) {
  const { series, source } = seriesFor(symbol);
  if (!series) return { bars: [], source: 'none' };
  const sigIdx = indexForDay(series, signalDateMs);
  if (sigIdx < 0) return { bars: [], source };
  return { bars: forwardSlice(series, sigIdx, days), source };
}

// ── אירועי קטליסט / M&A — עדיין MOCK (אין פיד אמיתי מחובר) ───────────────────
// TODO(real-data): SEC EDGAR (8-K/13D) · Benzinga/Finnhub news · פיד M&A.
export function getCatalysts(dateMs) { return mockCatalysts(dateMs); }
export function getMnaEvents(dateMs) { return mockMnaEvents(dateMs); }
