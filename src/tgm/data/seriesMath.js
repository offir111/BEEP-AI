// TGM · Series Math — חישובים טהורים על סדרת נרות יומית (OHLCV).
// ────────────────────────────────────────────────────────────────────────────
// כל הפונקציות כאן טהורות (pure) ומקבלות series = מערך נרות ממוין עולה:
//   [{ t(ms), o, h, l, c, v }, ...]
// שתי שכבות הנתונים — LIVE (Yahoo דרך /api/candles) ו-MOCK (דטרמיניסטי) — מייצרות
// סדרה בצורה הזו, ואז מעשירות/מסמלצות דרך אותו קוד כאן. כך אין שני מסלולי חישוב.
// בזכות זה אפשר לבדוק את כל המתמטיקה ב-Node ללא דפדפן/רשת (scripts/test-tgm-*.mjs).
// ────────────────────────────────────────────────────────────────────────────

export const ATR_WINDOW = 14;   // ATR% על 14 ימי מסחר
export const VOL_WINDOW = 20;   // נפח יחסי מול ממוצע 20 יום
export const RES_WINDOW = 20;   // התנגדות = שיא 20 הימים שקדמו (לא כולל היום)
export const YEAR_DAYS = 252;   // ~ימי מסחר בשנה (שיא 52ש׳ + מגמה)

const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

export function dayKeyUTC(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** אינדקס הנר של יום-המסחר התואם ל-dateMs (אותו יום קלנדרי UTC), או -1. */
export function indexForDay(series, dateMs) {
  const want = dayKeyUTC(dateMs);
  for (let i = 0; i < series.length; i++) {
    if (dayKeyUTC(series[i].t) === want) return i;
  }
  return -1;
}

export function sma(series, endIdx, period) {
  if (endIdx + 1 < period) return null;
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) sum += series[i].c;
  return sum / period;
}

export function atrPct(series, endIdx, period = ATR_WINDOW) {
  if (endIdx < 1) return null;
  const start = Math.max(1, endIdx - period + 1);
  let sum = 0, n = 0;
  for (let i = start; i <= endIdx; i++) {
    const tr = Math.max(
      series[i].h - series[i].l,
      Math.abs(series[i].h - series[i - 1].c),
      Math.abs(series[i].l - series[i - 1].c)
    );
    sum += tr; n++;
  }
  if (!n) return null;
  const ref = series[endIdx].c || 1;
  return ((sum / n) / ref) * 100;
}

export function relVolume(series, endIdx, period = VOL_WINDOW) {
  if (endIdx < 1) return null;
  const start = Math.max(0, endIdx - period);
  let sum = 0, n = 0;
  for (let i = start; i < endIdx; i++) { sum += series[i].v; n++; }
  const avg = n ? sum / n : 0;
  if (!avg) return null;
  return series[endIdx].v / avg;
}

export function high52w(series, endIdx, period = YEAR_DAYS) {
  const start = Math.max(0, endIdx - period + 1);
  let hi = -Infinity;
  for (let i = start; i <= endIdx; i++) hi = Math.max(hi, series[i].h);
  return hi === -Infinity ? null : hi;
}

export function low52w(series, endIdx, period = YEAR_DAYS) {
  const start = Math.max(0, endIdx - period + 1);
  let lo = Infinity;
  for (let i = start; i <= endIdx; i++) lo = Math.min(lo, series[i].l);
  return lo === Infinity ? null : lo;
}

export function resistance(series, endIdx, period = RES_WINDOW) {
  if (endIdx < 1) return null;
  const start = Math.max(0, endIdx - period);
  let hi = -Infinity;
  for (let i = start; i < endIdx; i++) hi = Math.max(hi, series[i].h); // עד אתמול בלבד
  return hi === -Infinity ? null : hi;
}

/**
 * נר יומי "מועשר" מאינדקס בסדרה — הצורה שכל המנועים צורכים.
 * source מוזרק ע"י הקורא ('live' / 'mock').
 */
export function enrichBar(series, idx, source) {
  if (idx < 1 || idx >= series.length) return null;
  const bar = series[idx];
  const prevClose = series[idx - 1].c;
  const changePct = prevClose ? ((bar.c - prevClose) / prevClose) * 100 : 0;
  return {
    symbol: bar.symbol,
    open: r2(bar.o),
    high: r2(bar.h),
    low: r2(bar.l),
    close: r2(bar.c),
    prevClose: r2(prevClose),
    volume: bar.v,
    changePct: r2(changePct),
    atrPct: r2(atrPct(series, idx)),
    relVolume: r2(relVolume(series, idx)),
    high52w: r2(high52w(series, idx)),
    resistance: r2(resistance(series, idx)),
    sma50: r2(sma(series, idx, 50)),
    sma200: r2(sma(series, idx, 200)),
    _idx: idx,
    _source: source,
  };
}

/**
 * חלון מגמה שנתית עד endIdx (כולל): closes/highs/lows + ממוצעים נעים + שיא/שפל 52ש׳.
 */
export function trendWindow(series, endIdx, yearDays = YEAR_DAYS) {
  if (endIdx < 0) return null;
  const start = Math.max(0, endIdx - yearDays + 1);
  const window = series.slice(start, endIdx + 1);
  return {
    closes: window.map((b) => b.c),
    highs: window.map((b) => b.h),
    lows: window.map((b) => b.l),
    lastClose: series[endIdx].c,
    sma50: sma(series, endIdx, 50),
    sma200: sma(series, endIdx, 200),
    high52w: high52w(series, endIdx),
    low52w: low52w(series, endIdx),
  };
}

/** האינדקס של הנר האחרון שזמנו ≤ asOfMs (להתאמת "נכון לתאריך"), או -1. */
export function indexAsOf(series, asOfMs) {
  let idx = -1;
  for (let i = series.length - 1; i >= 0; i--) { if (series[i].t <= asOfMs) { idx = i; break; } }
  return idx;
}

/** עד `days` נרות יציאה *אחרי* יום הסיגנל (forward window נטול look-ahead). */
export function forwardSlice(series, signalIdx, days) {
  if (signalIdx < 0) return [];
  return series.slice(signalIdx + 1, signalIdx + 1 + days);
}
