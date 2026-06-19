// TGM · שכבת נתונים — ספק MOCK ריאליסטי (ברירת מחדל).
// ────────────────────────────────────────────────────────────────────────────
// כל הנתונים כאן הם דמו דטרמיניסטי (seeded) — אותו סימבול+תאריך תמיד מחזיר
// אותו נר, כך שיצירת ליד והערכתו עקביות בין רענונים.
//
// TODO(real-data): להחליף את הספק הזה בספק אמיתי במקום אחד בלבד — dataLayer.js.
//   מועמדים: Polygon.io (/v2/aggs), Alpha Vantage (TIME_SERIES_DAILY), Finnhub (/stock/candle).
//   הממשק שהמנועים צורכים מוגדר ב-dataLayer.js — מספיק לממש אותו מול ה-API האמיתי.
// ────────────────────────────────────────────────────────────────────────────

// PRNG דטרמיניסטי (mulberry32) — מאותחל מתוך hash של מחרוזת.
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── יקום מניות ריאליסטי (US) — מיובא מהמודול המשותף universe.js. ──
export { MOCK_UNIVERSE } from './universe';
import { MOCK_UNIVERSE } from './universe';


// ── מנוע נרות יומי דטרמיניסטי ──────────────────────────────────────────────
// מחזיר נר יומי לסימבול בתאריך נתון: { open, high, low, close, volume, prevClose,
//   changePct, atrPct, relVolume }. כל הערכים נגזרים מ-seed יציב.
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

// מניות "חמות" — תנודתיות גבוהה במיוחד. הן שמזינות בעיקר את מנוע המומנטום
// (ATR%>5 / שינוי>±5%), ובהן המומנטום אכן נוטה להיתקל ב-SL לעיתים קרובות.
const HOT_VOL = new Set(['MARA', 'SMCI', 'CVNA', 'RIVN', 'MRNA', 'GME', 'COIN', 'XPEV', 'SOFI', 'LCID']);

export function mockDailyBar(stock, dateMs) {
  const rnd = mulberry32(hashStr(`${stock.symbol}|${dayKey(dateMs)}`));

  // תנודתיות יומית בסיסית פר-מניה (מניות חמות / קטנות תנודתיות יותר).
  const speculative = stock.marketCapM < 30000 || stock.price < 15;
  const baseVol = HOT_VOL.has(stock.symbol) ? 0.065 : speculative ? 0.03 : 0.017;

  const prevClose = stock.price * (0.9 + rnd() * 0.2); // עוגן סביב מחיר הייחוס
  const changePct = (rnd() * 2 - 1) * baseVol * 100 * (0.8 + rnd() * 0.8); // % שינוי יומי
  // פתיחה קרובה לסגירה הקודמת (גאפ קטן); הסגירה לפי השינוי היומי.
  const open = prevClose * (1 + (rnd() * 2 - 1) * baseVol * 0.2);
  const close = prevClose * (1 + changePct / 100);

  // טווח תוך-יומי עם חפיפה אמיתית סביב הגוף: כך כניסת LONG בפתיחה אינה
  // נקבעת מראש לפי כיוון הסגירה — יום עולה עלול לגעת קודם ב-SL, ויום יורד
  // עלול לגעת קודם ב-TP. זה מה שמייצר התפלגות תוצאות ריאליסטית (לא 0% ולא 100%).
  const body = prevClose * baseVol;
  const swingUp = body * (0.4 + rnd() * 1.2);
  const swingDn = body * (0.4 + rnd() * 1.2);
  const high = Math.max(open, close) + swingUp;
  const low = Math.min(open, close) - swingDn;

  const atrPct = ((high - low) / prevClose) * 100;          // קירוב ATR% מתוך טווח היום
  const relVolume = 0.6 + rnd() * 3.4;                       // נפח יחסי 0.6–4.0
  const volume = Math.round(stock.avgVolM * 1e6 * relVolume);

  // שיא 52 שבועות: יציב פר-מניה. התנגדות: רמה 3%–8% מעל הסגירה הקודמת (פריצה אמיתית).
  const high52w = stock.price * (1.15 + mulberry32(hashStr(stock.symbol + '|52w'))() * 0.6);
  const resistance = prevClose * (1 + 0.02 + rnd() * 0.05);

  return {
    symbol: stock.symbol,
    open: round2(open),
    high: round2(high),
    low: round2(low),
    close: round2(close),
    prevClose: round2(prevClose),
    volume,
    changePct: round2(changePct),
    atrPct: round2(atrPct),
    relVolume: round2(relVolume),
    high52w: round2(high52w),
    resistance: round2(resistance),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── סדרת נרות שנתית דטרמיניסטית (MOCK) ──────────────────────────────────────
// מייצרת סדרה רציפה של ~days ימי מסחר המסתיימת ב-endMs, עם דריפט שנתי קבוע
// פר-מניה (כך שיתקבל פיזור ריאליסטי של מגמות עולות/יורדות/ניטרליות לסיווג ה-Trend),
// סגירה אחרונה ≈ מחיר הייחוס של המניה. כל ערך נגזר מ-seed יציב → אותו קלט = אותו פלט.
// משמשת את dataLayer במצב MOCK עבור: נרות יומיים, forward window, ומגמה שנתית —
// דרך אותו seriesMath שמשמש את ה-LIVE. הסדרה היא DEMO ומסומנת ככזו ב-UI.
function mockAnnualDrift(symbol) {
  // דריפט שנתי קבוע פר-מניה בטווח ~ -75%..+85% (פיזור לסיווג מגמה).
  const u = mulberry32(hashStr(symbol + '|annual'))();
  return -0.75 + u * 1.6;
}
function mockAnnualVol(symbol) {
  // תנודתיות יומית פר-מניה (מניות חמות/ספקולטיביות תנודתיות יותר). מכוילת כך
  // שמנוע המומנטום (ATR%>5) יופעל מדי פעם ב-MOCK — לצורך הדגמה (מסומן MOCK).
  const base = HOT_VOL.has(symbol) ? 0.095 : 0.03;
  const u = mulberry32(hashStr(symbol + '|vol'))();
  return base * (0.7 + u * 0.9);
}

export function mockSeries(stock, endMs, days = 300) {
  const drift = mockAnnualDrift(stock.symbol);
  const vol = mockAnnualVol(stock.symbol);
  const endPrice = stock.price;
  const startPrice = endPrice / (1 + drift); // כך שהסגירה האחרונה ≈ מחיר הייחוס
  const dailyDrift = Math.pow(1 + drift, 1 / Math.max(days, 1)) - 1;

  // אוסף את תאריכי ימי-המסחר (מדלג סופ״ש) אחורה מ-endMs, ואז בונה קדימה.
  const dates = [];
  let cursor = new Date(Date.UTC(new Date(endMs).getUTCFullYear(), new Date(endMs).getUTCMonth(), new Date(endMs).getUTCDate()));
  let guard = 0;
  while (dates.length < days && guard < days * 2 + 20) {
    guard++;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.unshift(cursor.getTime());
    cursor = new Date(cursor.getTime() - 86400000);
  }

  const series = [];
  let close = startPrice;
  for (let i = 0; i < dates.length; i++) {
    const rnd = mulberry32(hashStr(`${stock.symbol}|series|${i}`));
    const prevClose = close;
    const shock = (rnd() * 2 - 1) * vol;          // רעש יומי
    close = prevClose * (1 + dailyDrift + shock);
    if (close <= 0.01) close = prevClose * 0.5;   // הגנה
    const open = prevClose * (1 + (rnd() * 2 - 1) * vol * 0.3);
    const body = Math.abs(close - open);
    const range = body + prevClose * vol * (0.6 + rnd() * 1.0);
    const high = Math.max(open, close) + range * (0.2 + rnd() * 0.5);
    const low = Math.min(open, close) - range * (0.2 + rnd() * 0.5);
    // נפח בסיס סביב הממוצע, עם זינוקי-נפח אקראיים (~12% מהימים) — כך ש-relVolume
    // (נפח/ממוצע) חוצה לעיתים את ספי האישור של המנועים (פריצה>1.5, מומנטום>2.5).
    const relV = 0.7 + rnd() * 0.8;
    const spike = rnd() < 0.12 ? (2.2 + rnd() * 3.0) : 1;
    series.push({
      t: dates[i],
      o: round2(open), h: round2(high), l: round2(Math.max(0.01, low)), c: round2(close),
      v: Math.round(stock.avgVolM * 1e6 * relV * spike),
      symbol: stock.symbol,
    });
  }
  // עיגון הסגירה האחרונה למחיר הייחוס (כדי שהמחיר ה"נוכחי" יהיה עקבי עם היקום).
  if (series.length) {
    const last = series[series.length - 1];
    const k = endPrice / last.c;
    last.c = round2(last.c * k); last.h = round2(Math.max(last.h * k, last.c)); last.o = round2(last.o * k);
    last.l = round2(Math.min(last.l * k, last.c));
  }
  return series;
}

// ── אירועי קטליסט (חדשות / 8-K / 13D / השקעות ענק / חוזים) — MOCK ──────────
// TODO(real-data): לחבר ל-SEC EDGAR (8-K/13D), Benzinga / Finnhub news, Quiver.
const CATALYST_TEMPLATES = [
  { type: '8-K',       reason: 'הגשת 8-K — אירוע מהותי (שינוי הנהלה / הסכם מהותי)' },
  { type: '13D',       reason: 'הגשת 13D — משקיע אקטיביסטי צבר >5% מהמניה' },
  { type: 'contract',  reason: 'זכייה בחוזה ממשלתי/תאגידי גדול' },
  { type: 'investment',reason: 'הזרמת הון / השקעת ענק ממשקיע אסטרטגי' },
  { type: 'guidance',  reason: 'העלאת תחזית רווח (guidance raise)' },
  { type: 'upgrade',   reason: 'שדרוג אנליסטים עם יעד מחיר מוגדל' },
];

export function mockCatalysts(dateMs) {
  const rnd = mulberry32(hashStr('catalyst|' + dayKey(dateMs)));
  const pool = MOCK_UNIVERSE;
  const out = [];
  const n = 2 + Math.floor(rnd() * 3); // 2–4 אירועים ביום
  for (let i = 0; i < n; i++) {
    const stock = pool[Math.floor(rnd() * pool.length)];
    const tpl = CATALYST_TEMPLATES[Math.floor(rnd() * CATALYST_TEMPLATES.length)];
    out.push({ symbol: stock.symbol, type: tpl.type, reason: tpl.reason });
  }
  return dedupeBySymbol(out);
}

// ── אירועי M&A (שמועות/הכרזות מיזוג ורכישה) — MOCK ─────────────────────────
// TODO(real-data): לחבר לפיד M&A (Bloomberg/Reuters rumors, SEC merger filings).
const MNA_TEMPLATES = [
  { type: 'rumor',        reason: 'שמועת רכישה — דווח על שיחות מקדמיות' },
  { type: 'announcement', reason: 'הכרזת מיזוג רשמית עם פרמיה למחיר השוק' },
  { type: 'bid',          reason: 'הצעת רכש (tender offer) מעל מחיר השוק' },
  { type: 'stake',        reason: 'גוף אסטרטגי רכש נתח מהותי — ספקולציית השתלטות' },
];

export function mockMnaEvents(dateMs) {
  const rnd = mulberry32(hashStr('mna|' + dayKey(dateMs)));
  const pool = MOCK_UNIVERSE;
  const out = [];
  const n = 1 + Math.floor(rnd() * 2); // 1–2 אירועי M&A ביום
  for (let i = 0; i < n; i++) {
    const stock = pool[Math.floor(rnd() * pool.length)];
    const tpl = MNA_TEMPLATES[Math.floor(rnd() * MNA_TEMPLATES.length)];
    const premiumPct = 8 + Math.floor(rnd() * 25); // פרמיה 8%–32%
    out.push({ symbol: stock.symbol, type: tpl.type, reason: `${tpl.reason} (~+${premiumPct}%)`, premiumPct });
  }
  return dedupeBySymbol(out);
}

function dedupeBySymbol(arr) {
  const seen = new Set();
  return arr.filter((x) => (seen.has(x.symbol) ? false : (seen.add(x.symbol), true)));
}
