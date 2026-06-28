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

/* רשימת 6 הקריטריונים, לפי הסדר שמוצג ב-UI. */
export const OFFIR_CRITERIA = [
  { key: 'marketCap',   label: 'מרקט-קאפ ≥ 500M$' },
  { key: 'aboveSMA200', label: 'מעל SMA200' },
  { key: 'slopeUp',     label: 'שיפוע שנתי חיובי' },
  { key: 'volatility',  label: 'תנודתיות 2%–20%' },
  { key: 'entryZone',   label: 'אזור כניסה (רבע תחתון)' },
  { key: 'trendIntact', label: 'מגמה שלמה (לא נשברה)' },
];

export const MIN_MARKET_CAP = 500e6;

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
 * analyzeOffir — מריץ את כל הקריטריונים ומחזיר סטטוס 🟢/🟡/🔴.
 *
 * @param {Array}  candles            נרות יומיים (~שנה)
 * @param {object} [opts]
 * @param {number} [opts.marketCap]   שווי שוק / AUM ($); null = לא ידוע (לא פוסל)
 * @param {string} [opts.assetType]   'STOCK' | 'ETF'
 */
export function analyzeOffir(candles, { marketCap = null, assetType = 'STOCK' } = {}) {
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

  /* מיקום בתעלה: 0% = גבול תחתון, 100% = גבול עליון. <0 = שבר כלפי מטה. */
  let channelPos = null, brokeBelow = false;
  if (ch && last != null) {
    const width = ch.upper - ch.lower;
    channelPos = width > 0 ? ((last - ch.lower) / width) * 100 : 50;
    brokeBelow = last < ch.lower;
  }

  const aboveSMA200 = (sma200 != null && last != null) ? last > sma200 : null;
  const slopeUp     = ch ? ch.slope > 0 : null;
  const volOK       = atrPct != null ? (atrPct >= 2 && atrPct <= 20) : null;
  const mcapOK      = marketCap != null ? marketCap >= MIN_MARKET_CAP : null; // null = לא ידוע
  const entryZone   = channelPos != null ? channelPos <= 25 : null;
  const volBreak    = vSpike != null && vSpike >= 3 && dropping;
  const trendIntact = !brokeBelow && !volBreak;

  /* ── סיווג סטטוס ──
   * 🔴 זהירות: שבר גבול תחתון / מתחת ל-SMA200 / נפח-שבירה חריג / אין מגמה עולה תקפה.
   * 🟢 כניסה: מגמה עולה תקפה + רבע תחתון של התעלה + לא נשברה.
   * 🟡 המתן: מגמה עולה תקפה אבל לא בנקודת כניסה.
   */
  const validUptrend = aboveSMA200 === true && slopeUp === true;
  let status, statusLabel;
  if (brokeBelow || aboveSMA200 === false || volBreak || !validUptrend) {
    status = 'red'; statusLabel = 'זהירות';
  } else if (entryZone) {
    status = 'green'; statusLabel = 'כניסה';
  } else {
    status = 'yellow'; statusLabel = 'המתן';
  }

  /* סיבה ראשית להצגה */
  const reason =
    brokeBelow                ? 'שבר את גבול התעלה התחתון כלפי מטה' :
    aboveSMA200 === false     ? 'מתחת ל-SMA200 — חשד לשבירת מגמה' :
    volBreak                  ? `נפח חריג (×${vSpike?.toFixed(1)}) בירידה` :
    !validUptrend             ? 'אין מגמה שנתית עולה תקפה' :
    status === 'green'        ? 'בגבול התחתון של תעלת מגמה עולה — נקודת כניסה' :
                                'מגמה עולה, אך לא באזור כניסה';

  const criteria = {
    marketCap:   { pass: mcapOK,      value: marketCap, unknown: mcapOK === null },
    aboveSMA200: { pass: aboveSMA200, value: sma200, partial: !fullSMA },
    slopeUp:     { pass: slopeUp,     value: ch ? ch.slope : null },
    volatility:  { pass: volOK,       value: atrPct },
    entryZone:   { pass: entryZone,   value: channelPos },
    trendIntact: { pass: trendIntact, value: vSpike },
  };

  return {
    enough, last, sma200, fullSMA, assetType,
    channel: ch, channelPos, brokeBelow,
    atrPct, volSpike: vSpike,
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
