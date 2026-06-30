/**
 * offirModel.js — מנוע הניתוח הטכני של רובוט +OFFIR ("סורק ביטחונות").
 *
 * רעיון: מסחר בלי סטופ-לוס על מניות במגמה שנתית עולה עם גב חיצוני חזק,
 * שירדו לגבול התחתון של תעלת המגמה — נקודת כניסה. הליבה היא **תעלת מגמה**
 * המחושבת ברגרסיה לינארית על מחירי הסגירה השנתיים + סטיית תקן לרוחב התעלה.
 *
 * פונקציות טהורות בלבד — נבדקות headless ב-scripts/test-offir.mjs.
 * הקלט: מערך נרות יומיים [{time,open,high,low,close,volume}] (~שנה).
 */

/* רשימת 6 הקריטריונים, לפי מסמך ה-CHECK של +OFFIR, בסדר שמוצג ב-UI. */
export const OFFIR_CRITERIA = [
  { key: 'marketCap',  label: 'שווי שוק ≥ 500M$' },
  { key: 'hotSector',  label: 'סקטור חם' },
  { key: 'catalyst',   label: 'קטליסט חיובי' },
  { key: 'uptrend',    label: 'מגמת עלייה שנתית' },
  { key: 'volatility', label: 'תנודתיות יומית 2%–20%' },
  { key: 'dipFromHigh', label: 'ירידה ≥20% מהשיא המקומי' },
];

export const MIN_MARKET_CAP = 500e6;
export const MIN_DIP_PCT = 20;            // קריטריון 6: ירידה מינ' מהשיא המקומי
export const DIP_LOOKBACK = 132;          // ~6 חודשי מסחר ל"שיא מקומי"

/* ── קריטריון 2: סקטור חם ──────────────────────────────────────────
 * תזת הרובוט: AI/HPC + קריפטו/טכנולוגיה. מזהים "חם" לפי סקטור+תעשייה
 * מ-Finviz, ובנוסף רמז (שם החברה + הקטליסט) שתופס כורי-קריפטו שמסווגים
 * תחת Financial/Capital-Markets ו-ETF-ים קריפטוגרפיים שתחת Exchange-Traded-Fund.
 */
const HOT_PATTERNS = [
  'technolog', 'semiconduct', 'software', 'information technology',
  'communication', 'internet', 'data center', 'data processing',
  'capital market', 'energy',
];
const THEME_PATTERNS = [
  'ai', 'hpc', 'compute', 'cloud', 'data center',
  'bitcoin', 'solana', 'crypto', 'blockchain', 'mining', 'digital asset',
];

function matchAny(hay, patterns) {
  for (const p of patterns) if (hay.includes(p)) return p;
  return null;
}

/**
 * isHotSector — מחזיר { hot, sector, matched } או hot=null אם אין נתון סקטור כלל.
 * @param {string} sector   סקטור (Finviz)
 * @param {string} industry תעשייה (Finviz)
 * @param {string} hint     רמז נוסף — שם החברה + טקסט הקטליסט
 */
export function isHotSector(sector, industry, hint = '') {
  const hasSector = !!(sector || industry);
  const themeHay = ` ${String(hint).toLowerCase()} `;
  // theme יכול להפוך "חם" גם בלי סקטור (לפי שם/קטליסט)
  const themeMatch =
    THEME_PATTERNS.find(p => themeHay.includes(` ${p} `) || themeHay.includes(p));
  if (!hasSector && !themeMatch) return { hot: null, sector: null, matched: null };
  const secHay = `${String(sector || '').toLowerCase()} ${String(industry || '').toLowerCase()}`;
  const secMatch = matchAny(secHay, HOT_PATTERNS);
  const matched = secMatch || themeMatch || null;
  return { hot: !!matched, sector: sector || null, matched };
}

/* ── קריטריון 3: קטליסט חיובי (שכבת NLP בסיסית) ────────────────────
 * ניקוד מילות-מפתח חיוביות מול שליליות (אנגלית+עברית). חיובי = יש טקסט,
 * אין דגל שלילי דומיננטי, ויש לפחות אות חיובית אחת.
 */
const POS_WORDS = [
  'deal', 'partnership', 'partner', 'contract', 'expansion', 'expand',
  'acquisition', 'acquire', 'upgrade', 'beat', 'record', 'growth', 'surge',
  'ai', 'hpc', 'cloud', 'launch', 'approval', 'approved', 'demand', 'backing',
  'invest', 'investment', 'breakthrough', 'milestone', 'guidance raise',
  // תזת קריפטו/חשיפת-ספוט = הקטליסט החיובי של ה-ETF-ים ברשימת ברירת-המחדל
  'bitcoin', 'solana', 'crypto', 'blockchain', 'spot', 'exposure', 'etf',
  'עסקה', 'שותפות', 'גידול', 'שדרוג', 'הסכם', 'השקעה', 'פריצה', 'גב', 'ביקוש', 'חשיפה',
];
const NEG_WORDS = [
  'lawsuit', 'downgrade', 'dilution', 'bankruptcy', 'bankrupt', 'miss', 'fraud',
  'delisting', 'delist', 'investigation', 'sec probe', 'default', 'halt',
  'תביעה', 'דילול', 'חקירה', 'פשיטת רגל', 'הורדת דירוג', 'הונאה',
];

export function scoreCatalyst(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return { hasCatalyst: false, positive: null, score: 0, pos: 0, neg: 0 };
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (t.includes(w)) pos++;
  for (const w of NEG_WORDS) if (t.includes(w)) neg++;
  const score = pos - neg;
  // קטליסט חיובי: יש מילים חיוביות, והן גוברות על השליליות.
  const positive = pos > 0 && score > 0;
  return { hasCatalyst: true, positive, score, pos, neg };
}

/* ── קריטריון 6: ירידה מהשיא המקומי ────────────────────────────────
 * שיא מקומי = ה-high הגבוה ביותר בחלון ~6 חודשים אחרון. אחוז הירידה
 * מחושב מהשיא הזה אל מחיר הסגירה האחרון.
 */
export function dipFromLocalHigh(candles, lookback = DIP_LOOKBACK, fallbackHigh = null) {
  const arr = Array.isArray(candles) ? candles : [];
  const last = arr.length ? arr[arr.length - 1].close : null;
  if (last == null || !Number.isFinite(last)) return { localHigh: null, dipPct: null, pass: null };
  const window = arr.slice(-lookback);
  let hi = -Infinity;
  for (const c of window) {
    const h = Number.isFinite(c.high) ? c.high : c.close;
    if (Number.isFinite(h) && h > hi) hi = h;
  }
  if (Number.isFinite(fallbackHigh) && fallbackHigh > hi) hi = fallbackHigh;
  if (!Number.isFinite(hi) || hi <= 0) return { localHigh: null, dipPct: null, pass: null };
  const dipPct = ((hi - last) / hi) * 100;
  return { localHigh: hi, dipPct, pass: dipPct >= MIN_DIP_PCT };
}

/* ── ממוצע נע פשוט על N הערכים האחרונים ───────────────────────── */
export function sma(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  let s = 0;
  for (let i = values.length - period; i < values.length; i++) s += values[i];
  return s / period;
}

/* ── תעלת רגרסיה לינארית ───────────────────────────────────────
 * least-squares על x=0..n-1 → close. רוחב התעלה = k·(סטיית-תקן שאריות).
 * מחזיר את ערכי הקו והגבולות בנקודה האחרונה (n-1).
 */
export function linregChannel(closes, k = 2) {
  const n = Array.isArray(closes) ? closes.length : 0;
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += closes[i]; sxx += i * i; sxy += i * closes[i]; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  let ss = 0;
  for (let i = 0; i < n; i++) { const fit = intercept + slope * i; const d = closes[i] - fit; ss += d * d; }
  const std = Math.sqrt(ss / n);
  const mid = intercept + slope * (n - 1);
  return { slope, intercept, std, mid, upper: mid + k * std, lower: mid - k * std };
}

/* ── ATR יומי באחוזים מהמחיר (תנודתיות) ───────────────────────── */
export function atrPercent(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const lastTrs = trs.slice(-period);
  const atr = lastTrs.reduce((a, b) => a + b, 0) / lastTrs.length;
  const last = candles[candles.length - 1].close;
  return last ? (atr / last) * 100 : null;
}

/* ── יחס נפח יומי אחרון מול ממוצע N הימים שקדמו לו ─────────────── */
export function volumeSpike(candles, period = 20) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const vols = candles.map(c => c.volume || 0);
  const last = vols[vols.length - 1];
  const prev = vols.slice(-period - 1, -1);
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  return avg ? last / avg : null;
}

/**
 * analyzeOffir — מריץ את 6 קריטריוני הסינון ומחזיר סטטוס 🟢/🟡/🔴.
 *
 * @param {Array}  candles             נרות יומיים (~שנה)
 * @param {object} [opts]
 * @param {number} [opts.marketCap]    שווי שוק / AUM ($); null = לא ידוע (לא פוסל)
 * @param {string} [opts.assetType]    'STOCK' | 'ETF'
 * @param {string} [opts.sector]       סקטור (Finviz)            → קריטריון 2
 * @param {string} [opts.industry]     תעשייה (Finviz)           → קריטריון 2
 * @param {string} [opts.hint]         שם + קטליסט (לזיהוי תזה)  → קריטריון 2
 * @param {string} [opts.catalyst]     טקסט הקטליסט              → קריטריון 3
 * @param {number} [opts.week52High]   שיא 52-שבועות (גיבוי)     → קריטריון 6
 */
export function analyzeOffir(candles, {
  marketCap = null, assetType = 'STOCK',
  sector = null, industry = null, hint = '',
  catalyst = '', week52High = null,
} = {}) {
  const arr = Array.isArray(candles) ? candles : [];
  const closes = arr.map(c => c.close).filter(Number.isFinite);
  const enough = closes.length >= 50;
  const last = closes.length ? closes[closes.length - 1] : null;
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : last;
  const dropping = last != null && prevClose != null && last < prevClose;

  const fullSMA = closes.length >= 200;
  const sma200 = sma(closes, Math.min(200, closes.length));
  const ch = linregChannel(closes);
  const atrPct = atrPercent(arr);
  const vSpike = volumeSpike(arr);

  /* מיקום בתעלה (להצגה בלבד): 0% = גבול תחתון, 100% = עליון. <0 = שבר מטה. */
  let channelPos = null, brokeBelow = false;
  if (ch && last != null) {
    const width = ch.upper - ch.lower;
    channelPos = width > 0 ? ((last - ch.lower) / width) * 100 : 50;
    brokeBelow = last < ch.lower;
  }

  /* ── 6 הקריטריונים ── */
  // 1) שווי שוק ≥ 500M$ (ETF ללא mcap → לא ידוע, לא פוסל)
  const mcapOK = marketCap != null ? marketCap >= MIN_MARKET_CAP : null;
  // 2) סקטור חם
  const hot = isHotSector(sector, industry, hint);
  // 3) קטליסט חיובי (NLP בסיסי)
  const cat = scoreCatalyst(catalyst);
  // 4) מגמת עלייה שנתית (מעל SMA200 + שיפוע חיובי)
  const aboveSMA200 = (sma200 != null && last != null) ? last > sma200 : null;
  const slopeUp     = ch ? ch.slope > 0 : null;
  const uptrend     = (aboveSMA200 != null && slopeUp != null)
    ? (aboveSMA200 === true && slopeUp === true) : null;
  // 5) תנודתיות יומית 2%–20%
  const volOK = atrPct != null ? (atrPct >= 2 && atrPct <= 20) : null;
  // 6) ירידה ≥20% מהשיא המקומי
  const dip = dipFromLocalHigh(arr, DIP_LOOKBACK, week52High);

  // עזר פנימי לסטטוס (לא בין 6 הקריטריונים): שבירת-נפח חריגה בירידה.
  const volBreak = vSpike != null && vSpike >= 3 && dropping;

  /* ── סיווג סטטוס (מסחר conviction, ללא סטופ-לוס) ──
   * 🔴 זהירות: אין מגמה שנתית עולה / שבר גבול תעלה תחתון / נפח-שבירה חריג.
   * 🟢 כניסה: מגמה עולה תקפה + ירדה ≥20% מהשיא (הנחה) + לא נשברה.
   * 🟡 המתן: מגמה עולה תקפה אך עדיין קרובה לשיא (לא באזור הנחה).
   */
  const validUptrend = uptrend === true;
  let status, statusLabel;
  if (!validUptrend || brokeBelow || volBreak) {
    status = 'red'; statusLabel = 'זהירות';
  } else if (dip.pass) {
    status = 'green'; statusLabel = 'כניסה';
  } else {
    status = 'yellow'; statusLabel = 'המתן';
  }

  /* סיבה ראשית להצגה */
  const reason =
    aboveSMA200 === false ? 'מתחת ל-SMA200 — חשד לשבירת מגמה' :
    !validUptrend         ? 'אין מגמה שנתית עולה תקפה' :
    brokeBelow            ? 'שבר את גבול התעלה התחתון כלפי מטה' :
    volBreak              ? `נפח חריג (×${vSpike?.toFixed(1)}) בירידה` :
    dip.pass              ? `ירד ${dip.dipPct?.toFixed(0)}% מהשיא המקומי במגמה עולה — נקודת כניסה` :
                            `מגמה עולה, אך רק ${dip.dipPct != null ? dip.dipPct.toFixed(0) : '—'}% מהשיא (פחות מ-20%)`;

  const criteria = {
    marketCap:   { pass: mcapOK,       value: marketCap, unknown: mcapOK === null },
    hotSector:   { pass: hot.hot,      value: hot.sector, unknown: hot.hot === null, matched: hot.matched },
    catalyst:    { pass: cat.positive, value: catalyst || null, unknown: !cat.hasCatalyst },
    uptrend:     { pass: uptrend,      value: ch ? ch.slope : null, partial: !fullSMA },
    volatility:  { pass: volOK,        value: atrPct },
    dipFromHigh: { pass: dip.pass,     value: dip.dipPct, localHigh: dip.localHigh },
  };

  return {
    enough, last, sma200, fullSMA, assetType,
    channel: ch, channelPos, brokeBelow,
    atrPct, volSpike: vSpike,
    sector: hot.sector, hotSector: hot.hot, catalystScore: cat,
    dip,
    status, statusLabel, reason, criteria,
  };
}

/* ── ברירת-מחדל ל-Watchlist (5 סלוטים) + גב/קטליסט סטטי ידני ──────
 * apiSymbol = הסמל ל-Yahoo proxy (חלק מהטיקרים מוצגים אחרת מהסמל בבורסה).
 */
export const DEFAULT_WATCHLIST = [
  { ticker: 'CIFR', apiSymbol: 'CIFR', name: 'Cipher Mining',        type: 'STOCK',
    catalyst: 'מעבר ל-AI/HPC; עסקת ענן עם Google — גב חיצוני חזק.' },
  { ticker: 'HUT8', apiSymbol: 'HUT',  name: 'Hut 8 Corp',           type: 'STOCK',
    catalyst: 'מעבר מ-Bitcoin mining ל-AI/HPC compute.' },
  { ticker: 'KEEL', apiSymbol: 'KEEL', name: 'Keel Infrastructure',  type: 'STOCK',
    catalyst: 'לשעבר Bitfarms — פנייה מ-Bitcoin ל-AI/HPC.' },
  { ticker: 'BSOL', apiSymbol: 'BSOL', name: 'Solana Spot ETF',      type: 'ETF',
    catalyst: 'חשיפת ספוט ל-Solana.' },
  { ticker: 'HODL', apiSymbol: 'HODL', name: 'Bitcoin Spot ETF',     type: 'ETF',
    catalyst: 'חשיפת ספוט ל-Bitcoin.' },
];

/* מיפוי טיקר-תצוגה → סמל-Yahoo עבור טיקרים שהמשתמש מקליד ידנית. */
export const SYMBOL_ALIAS = { HUT8: 'HUT', BITF: 'BITF' };

export function resolveApiSymbol(ticker) {
  const t = String(ticker || '').trim().toUpperCase();
  return SYMBOL_ALIAS[t] || t;
}

/* ── נתוני MOCK דטרמיניסטיים (כשהפרוקסי לא מחזיר נרות אמיתיים) ─────
 * סדרת שנה עם מגמה עולה + תנודתיות סינוסואידלית; seed לפי הטיקר כדי
 * שכל מניה תיתן סטטוס יציב ושונה. מסומן MOCK בבירור ב-UI.
 */
export function mockCandles(ticker, days = 220) {
  let seed = 0;
  const t = String(ticker || 'XXX').toUpperCase();
  for (const c of t) seed = (seed * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const base = 4 + (seed % 60);
  const drift = base * (0.0012 + rand() * 0.0016);   // מגמה עולה
  const amp = base * (0.05 + rand() * 0.07);          // רוחב תנודה בתוך התעלה
  const phase = rand() * Math.PI * 2;
  const dayMs = 86400;
  const startT = Math.floor(Date.now() / 1000) - days * dayMs;

  const candles = [];
  for (let i = 0; i < days; i++) {
    const trend = base + drift * i;
    const wave = Math.sin(phase + i * 0.10) * amp;
    const noise = (rand() - 0.5) * base * 0.02;
    const close = Math.max(0.5, trend + wave + noise);
    const open = close - (rand() - 0.5) * base * 0.015;
    const high = Math.max(open, close) + rand() * base * 0.012;
    const low = Math.min(open, close) - rand() * base * 0.012;
    const volume = Math.floor(1e6 + rand() * 4e6);
    candles.push({ time: startT + i * dayMs, open, high, low, close, volume });
  }
  return candles;
}
