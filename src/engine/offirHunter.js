/**
 * offirHunter.js — "הצייד האוטומטי" של +OFFIR (שלב 2).
 *
 * רעיון: לוקחים את זרם ה-Gainers הקיים (/api/tv-screener) ו**הופכים** את ההיגיון —
 * במקום "מי עולה הכי חזק היום", מחפשים **dip בתוך מגמה שנתית עולה**: מניה שחזקה
 * ב-1Y אבל יורדת עכשיו (1D/1W), עם שווי-שוק אמיתי. השורט-ליסט עובר אח"כ דרך
 * מנוע ה-TA הקיים משלב 1 (analyzeOffir) לנתוני תנודתיות/עומק-dip/בטיחות אמיתיים,
 * ומקבל Conviction Score שקובע את סדר התצוגה.
 *
 * הקובץ הזה מחזיק את הלוגיקה הטהורה (prefilter + score) — נבדק headless.
 * שליפת הרשת (screener/candles) חיה ב-PlusOffirPage עם הפרוקסי הקיים.
 */

export const HUNTER = {
  MIN_YEAR_PCT: 20,        // קריטריון 1: מגמה שנתית עולה (חזקה)
  MIN_MARKET_CAP: 500e6,   // קריטריון 3
  VOL_MIN: 2, VOL_MAX: 20, // קריטריון 4: תנודתיות יומית %
  IDEAL_VOL: 9,            // מרכז טווח התנודתיות האידיאלי (לציון)
  MAX_SHORTLIST: 12,       // כמה מועמדים לבדוק לעומק (נרות) — חוסם עומס רשת
  MAX_RESULTS: 12,         // כמה כפתורים להציג בסוף
  // משקלי ה-Conviction Score
  W_TREND: 40, W_DIP: 35, W_SECTOR: 15, W_VOL: 10,
  // נורמליזציה
  TREND_FULL: 300,         // +300% שנתי = ציון מגמה מלא
  DIP_FULL: 40,            // ירידה 40% מהשיא = ציון dip מלא
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * passesPrefilter — סינון זול מזרם ה-Gainers (בלי נרות).
 * מחזיר { ok, dipping, reasons } כדי שאפשר להסביר פסילות.
 * תנאים: 1Y עולה חזק · שווי-שוק ≥500M · יורדת עכשיו (1D<0 או 1W<0).
 */
export function passesPrefilter(q, cfg = HUNTER) {
  const y = num(q?.pct_1y);
  const mc = num(q?.market_cap);
  const d1 = num(q?.chg1d);
  const w1 = num(q?.pct_1w);
  const reasons = [];

  const trendUp = y != null && y >= cfg.MIN_YEAR_PCT;
  if (!trendUp) reasons.push('אין מגמה שנתית עולה חזקה');

  const bigEnough = mc != null && mc >= cfg.MIN_MARKET_CAP;
  if (!bigEnough) reasons.push('שווי שוק < 500M');

  // dip = יורדת ביום או בשבוע (נקודת הכניסה). דורש לפחות אחד שלילי.
  const dipping = (d1 != null && d1 < 0) || (w1 != null && w1 < 0);
  if (!dipping) reasons.push('לא במצב dip (1D/1W לא שליליים)');

  return { ok: trendUp && bigEnough && dipping, dipping, reasons };
}

/**
 * huntPrefilter — מסנן יקום שלם ומחזיר שורט-ליסט ממוין לפי חוזק שנתי (החזק ראשון),
 * חתוך ל-MAX_SHORTLIST. כך בודקים נרות רק למספר קטן של מועמדים.
 */
export function huntPrefilter(quotes, cfg = HUNTER) {
  const arr = Array.isArray(quotes) ? quotes : [];
  return arr
    .filter(q => passesPrefilter(q, cfg).ok)
    .sort((a, b) => (num(b.pct_1y) ?? -1e9) - (num(a.pct_1y) ?? -1e9))
    .slice(0, cfg.MAX_SHORTLIST);
}

/* ── מרכיבי הציון (0..1 כל אחד) ── */
export function trendComponent(pct_1y, cfg = HUNTER) {
  const y = num(pct_1y); if (y == null) return 0;
  return clamp01(y / cfg.TREND_FULL);
}
export function dipComponent(dipPct, cfg = HUNTER) {
  const d = num(dipPct); if (d == null || d <= 0) return 0;
  return clamp01(d / cfg.DIP_FULL);
}
export function volComponent(atrPct, cfg = HUNTER) {
  const v = num(atrPct); if (v == null) return 0;
  if (v < cfg.VOL_MIN || v > cfg.VOL_MAX) return 0;        // מחוץ לטווח = 0
  return clamp01(1 - Math.abs(v - cfg.IDEAL_VOL) / cfg.IDEAL_VOL); // מרכז הטווח = 1
}

/**
 * convictionScore — ציון 0..100 שקובע את סדר המיון (גבוה = הזדמנות בשלה).
 * @param {object} p { pct_1y, dipPct, atrPct, hotSector(bool|null) }
 */
export function convictionScore(p, cfg = HUNTER) {
  const trend  = trendComponent(p?.pct_1y, cfg) * cfg.W_TREND;
  const dip    = dipComponent(p?.dipPct, cfg) * cfg.W_DIP;
  const sector = (p?.hotSector === true ? 1 : 0) * cfg.W_SECTOR; // unknown/false → 0 (בונוס בלבד)
  const vol    = volComponent(p?.atrPct, cfg) * cfg.W_VOL;
  const total = trend + dip + sector + vol;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * isSafeEntry — בטיחות (חופף לשלב 1): מניה ש**שברה** את גבול התעלה התחתון /
 * מתחת ל-SMA200 / נפח חריג בירידה / אין מגמה עולה תקפה — אינה הזדמנות (🔴),
 * ולכן לא נכנסת לרשימת הצייד. מקבל את אובייקט analyzeOffir.
 */
export function isSafeEntry(analysis) {
  if (!analysis) return false;
  if (analysis.status === 'red') return false;     // 🔴 = שבירה/מתחת SMA200/נפח חריג/אין מגמה
  if (analysis.brokeBelow) return false;
  return true;
}

/**
 * buildCandidate — מאחד שורת-gainer + ניתוח-TA לאובייקט מועמד מדורג.
 * מחזיר null אם לא בטוח/לא עומד בקריטריון התנודתיות.
 * @param {object} q        שורת tv-screener
 * @param {object} analysis תוצאת analyzeOffir על הנרות
 * @param {object} extra    { sector, hotSector } מ-offir-quote (אופציונלי)
 */
export function buildCandidate(q, analysis, extra = {}, cfg = HUNTER) {
  if (!analysis || !isSafeEntry(analysis)) return null;

  const atrPct = num(analysis.atrPct);
  // קריטריון 4: תנודתיות יומית חייבת להיות בטווח (אם ידועה). null = לא פוסל.
  if (atrPct != null && (atrPct < cfg.VOL_MIN || atrPct > cfg.VOL_MAX)) return null;

  // עומק ה-dip מהשיא המקומי (אמיתי מהנרות); נופל ל-1D מהזרם אם חסר.
  const dipPct = num(analysis.dip?.dipPct);
  const dayPct = num(q?.chg1d);
  const displayPct = dipPct != null ? -Math.abs(dipPct) : dayPct;   // מוצג כשלילי (ירידה)
  const dipSource = dipPct != null ? 'dip' : 'day';

  const hotSector = extra.hotSector ?? analysis.hotSector ?? null;
  const score = convictionScore(
    { pct_1y: num(q?.pct_1y), dipPct, atrPct, hotSector }, cfg
  );

  return {
    symbol: q.symbol,
    name: q.name || extra.name || '',
    price: num(q.price),
    marketCap: num(q.market_cap),
    pct_1y: num(q.pct_1y),
    dipPct,
    displayPct,
    dipSource,
    atrPct,
    sector: extra.sector ?? analysis.sector ?? null,
    hotSector,
    status: analysis.status,
    score,
  };
}

/** rankCandidates — ממיין לפי score יורד וחותך ל-MAX_RESULTS. */
export function rankCandidates(cands, cfg = HUNTER) {
  return (Array.isArray(cands) ? cands : [])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.MAX_RESULTS);
}
