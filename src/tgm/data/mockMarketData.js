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

// ── יקום מניות ריאליסטי (US). חלקן מתחת לסף בכוונה — לבדיקת מסנן היקום. ──
// flags: thinData=true → ה-API "האמיתי" לעיתים לא מחזיר מחיר יציאה (מדמה חור נתונים).
export const MOCK_UNIVERSE = [
  // symbol,  name,                       sector,            marketCapM, price, avgVolM
  { symbol: 'AAPL', name: 'Apple Inc.',                sector: 'Technology',     marketCapM: 3100000, price: 198.4, avgVolM: 54 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.',              sector: 'Technology',     marketCapM: 2900000, price: 121.7, avgVolM: 290 },
  { symbol: 'TSLA', name: 'Tesla Inc.',                sector: 'Consumer Disc.', marketCapM: 780000,  price: 246.2, avgVolM: 95 },
  { symbol: 'AMD',  name: 'Advanced Micro Devices',    sector: 'Technology',     marketCapM: 235000,  price: 146.1, avgVolM: 48 },
  { symbol: 'PLTR', name: 'Palantir Technologies',     sector: 'Technology',     marketCapM: 78000,   price: 34.9,  avgVolM: 62 },
  { symbol: 'SOFI', name: 'SoFi Technologies',         sector: 'Financials',     marketCapM: 9200,    price: 8.7,   avgVolM: 41 },
  { symbol: 'RIVN', name: 'Rivian Automotive',         sector: 'Consumer Disc.', marketCapM: 12500,   price: 13.2,  avgVolM: 28 },
  { symbol: 'COIN', name: 'Coinbase Global',           sector: 'Financials',     marketCapM: 58000,   price: 232.5, avgVolM: 14 },
  { symbol: 'MARA', name: 'Marathon Digital',          sector: 'Financials',     marketCapM: 5400,    price: 17.8,  avgVolM: 38 },
  { symbol: 'AFRM', name: 'Affirm Holdings',           sector: 'Financials',     marketCapM: 11000,   price: 36.4,  avgVolM: 9 },
  { symbol: 'SHOP', name: 'Shopify Inc.',              sector: 'Technology',     marketCapM: 96000,   price: 74.3,  avgVolM: 12 },
  { symbol: 'NET',  name: 'Cloudflare Inc.',           sector: 'Technology',     marketCapM: 33000,   price: 96.8,  avgVolM: 4 },
  { symbol: 'DKNG', name: 'DraftKings Inc.',           sector: 'Consumer Disc.', marketCapM: 18000,   price: 38.1,  avgVolM: 11 },
  { symbol: 'UBER', name: 'Uber Technologies',         sector: 'Technology',     marketCapM: 150000,  price: 71.5,  avgVolM: 22 },
  { symbol: 'SNAP', name: 'Snap Inc.',                 sector: 'Comm. Services', marketCapM: 18000,   price: 11.3,  avgVolM: 35, thinData: true },
  { symbol: 'F',    name: 'Ford Motor Co.',            sector: 'Consumer Disc.', marketCapM: 48000,   price: 12.1,  avgVolM: 70 },
  { symbol: 'CCL',  name: 'Carnival Corp.',            sector: 'Consumer Disc.', marketCapM: 24000,   price: 19.4,  avgVolM: 30 },
  { symbol: 'PFE',  name: 'Pfizer Inc.',               sector: 'Healthcare',     marketCapM: 145000,  price: 25.6,  avgVolM: 40 },
  { symbol: 'BAC',  name: 'Bank of America',           sector: 'Financials',     marketCapM: 310000,  price: 40.2,  avgVolM: 38 },
  { symbol: 'INTC', name: 'Intel Corp.',               sector: 'Technology',     marketCapM: 92000,   price: 21.3,  avgVolM: 55 },
  { symbol: 'WBD',  name: 'Warner Bros. Discovery',    sector: 'Comm. Services', marketCapM: 21000,   price: 8.4,   avgVolM: 33 },
  { symbol: 'CHWY', name: 'Chewy Inc.',                sector: 'Consumer Disc.', marketCapM: 12000,   price: 28.7,  avgVolM: 6 },
  { symbol: 'RBLX', name: 'Roblox Corp.',              sector: 'Comm. Services', marketCapM: 26000,   price: 41.2,  avgVolM: 9, thinData: true },
  { symbol: 'ROKU', name: 'Roku Inc.',                 sector: 'Comm. Services', marketCapM: 9500,    price: 64.8,  avgVolM: 5 },
  { symbol: 'CVNA', name: 'Carvana Co.',               sector: 'Consumer Disc.', marketCapM: 32000,   price: 245.0, avgVolM: 7 },
  { symbol: 'DELL', name: 'Dell Technologies',         sector: 'Technology',     marketCapM: 88000,   price: 122.5, avgVolM: 10 },
  { symbol: 'SMCI', name: 'Super Micro Computer',      sector: 'Technology',     marketCapM: 26000,   price: 44.6,  avgVolM: 45 },
  { symbol: 'LCID', name: 'Lucid Group',               sector: 'Consumer Disc.', marketCapM: 6800,    price: 2.9,   avgVolM: 40 }, // price<$3 — נופל במסנן
  { symbol: 'NKLA', name: 'Nikola Corp.',              sector: 'Industrials',    marketCapM: 420,     price: 4.1,   avgVolM: 25 }, // mktcap<500M — נופל
  { symbol: 'GME',  name: 'GameStop Corp.',            sector: 'Consumer Disc.', marketCapM: 9100,    price: 24.3,  avgVolM: 8 },
  { symbol: 'BBAI', name: 'BigBear.ai Holdings',       sector: 'Technology',     marketCapM: 380,     price: 3.4,   avgVolM: 12 }, // mktcap<500M — נופל
  { symbol: 'HOOD', name: 'Robinhood Markets',         sector: 'Financials',     marketCapM: 21000,   price: 23.1,  avgVolM: 16 },
  { symbol: 'XPEV', name: 'XPeng Inc.',                sector: 'Consumer Disc.', marketCapM: 8000,    price: 8.9,   avgVolM: 14 },
  { symbol: 'CLF',  name: 'Cleveland-Cliffs',          sector: 'Materials',      marketCapM: 6200,    price: 13.5,  avgVolM: 11 },
  { symbol: 'AA',   name: 'Alcoa Corp.',               sector: 'Materials',      marketCapM: 9800,    price: 38.0,  avgVolM: 7 },
  { symbol: 'MRNA', name: 'Moderna Inc.',              sector: 'Healthcare',     marketCapM: 47000,   price: 122.0, avgVolM: 6 },
];

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
