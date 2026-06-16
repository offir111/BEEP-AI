/**
 * TGM — שכבת קצירת לידים מערוצי טלגרם ציבוריים חינמיים.
 * מושך את עמוד התצוגה הציבורי https://t.me/s/<channel> (ללא חשבון/בוט),
 * ומפענח מהודעות טקסט חופשי סיגנל מובנה: { coin, direction, entry, tp, sl, date }.
 *
 * זהו פענוח "מיטב המאמץ" — פוסט שאי אפשר לחלץ ממנו coin+entry+TP+SL מדולגים.
 */

// ── רישום ערוצים: handle → שם הספק (כפי שמופיע בטבלת הדירוג) ──
export const TELEGRAM_CHANNELS = {
  cryptosignals: 'CryptoSignals.org',
  CryptoSignalFarmers: 'Crypto Signal Farmers',
};

const NON_COIN_TAGS = new Set([
  'SETUP', 'UPDATE', 'LONG', 'SHORT', 'TP', 'SL', 'BUY', 'SELL', 'VIP', 'FREE',
  'USDT', 'USD', 'DYOR', 'NFA', 'CMP', 'ATH', 'FOMC', 'CPI', 'SSL', 'BSL', 'FVG',
  'NY', 'US', 'EU', 'AI',
]);

// המרת אסימון מחיר לטקסט → מספר. תומך ב-$ , פסיקים, וסיומת k/m.
function parsePrice(tok) {
  if (!tok) return NaN;
  let s = String(tok).trim().replace(/[$,\s]/g, '');
  let mult = 1;
  const m = s.match(/^([\d.]+)\s*([km])?$/i);
  if (!m) return NaN;
  if (m[2]) mult = m[2].toLowerCase() === 'k' ? 1e3 : 1e6;
  const v = parseFloat(m[1]) * mult;
  return Number.isFinite(v) ? v : NaN;
}

// הסרת תוויות מספור שמזריקות ספרות מזויפות לפני חילוץ מחירים:
// "TP1:", "TP 2", "Target 3", "T4", "Entry 1", "1)", "2." → רווח.
function stripLabels(seg) {
  return String(seg || '')
    .replace(/\b(?:TP|TG|TARGET|ENTRY)\s*\d+\s*[:\)\-.]?/gi, ' ')
    .replace(/[│|]/g, ' ');
}

// כל אסימוני המחיר ברצף טקסט (לפי הסדר).
function extractPrices(seg) {
  if (!seg) return [];
  const out = [];
  const re = /\$?\s*([\d][\d.,]*\s*[km]?)\b/gi;
  let m;
  while ((m = re.exec(seg)) !== null) {
    const v = parsePrice(m[1]);
    if (Number.isFinite(v) && v > 0) out.push(v);
  }
  return out;
}

// ניקוי HTML של הודעה לטקסט שטוח.
function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#036;/g, '$')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// פענוח הודעה בודדת → סיגנל או null.
export function parseSignalText(text) {
  if (!text) return null;
  const t = text.replace(/\n/g, ' ');

  // 1) מטבע — תגית הראשונה שאינה מילת-מפתח.
  let coin = null;
  const tagRe = /#([A-Za-z]{2,6})\b/g;
  let tm;
  while ((tm = tagRe.exec(t)) !== null) {
    const c = tm[1].toUpperCase();
    if (!NON_COIN_TAGS.has(c)) { coin = c; break; }
  }
  if (!coin) return null;

  // 2) כיוון.
  const hasShort = /\b(short|sell)\b/i.test(t);
  const hasLong = /\b(long|buy|load|accumulate)\b/i.test(t);
  let direction;
  if (hasShort && !hasLong) direction = 'SHORT';
  else if (hasLong && !hasShort) direction = 'LONG';
  else if (hasShort && hasLong) direction = /\bshort\b/i.test(t.slice(t.search(/\bplay|entry|zone|reaction\b/i))) ? 'SHORT' : 'LONG';
  else direction = 'LONG';

  const idxOf = (re) => { const m = t.match(re); return m ? m.index : -1; };
  const tgtIdx = idxOf(/(?:scalp\s+)?(?:targets?|targeting|take[-\s]?profit)/i);
  const stopIdx = idxOf(/\b(?:invalidation|stop[-\s]?loss|stop)\b/i);

  // 3) סטופ — המחיר שאחרי מילת invalidation/stop (מדלג על "below/close/daily/H4").
  const stopMatch = t.match(/\b(?:invalidation|stop[-\s]?loss|stop)\b\s*[:\-]?\s*(?:below|under|above|close|daily|weekly|h4|h1|the|of|a)*[^\d$]*\$?\s*([\d.,]+\s*[km]?)/i);
  const sl = stopMatch ? parsePrice(stopMatch[1]) : NaN;

  // 4) יעדים — בוחר את רשימת היעדים העשירה ביותר (מבחין בין "Targeting:" נרטיבי לרשימת יעדים אמיתית).
  let tp = NaN;
  let bestCount = 0;
  for (const m of t.matchAll(/(?:scalp\s+)?(?:targets?|targeting|take[-\s]?profit)\s*[:\-]?\s*/gi)) {
    const seg = stripLabels(t.slice(m.index + m[0].length, m.index + m[0].length + 160));
    const prices = extractPrices(seg);
    if (prices.length > bestCount) { bestCount = prices.length; tp = prices[0]; }
  }

  // 5) כניסה — מילת מפתח entry/load zone עד מילת היעד/סטופ; גיבוי: טווח בסוגריים.
  let entry = NaN;
  const eIdx = idxOf(/(?:entry|load\s*zone|buy\s*zone|accumulation\s*zone)/i);
  if (eIdx >= 0) {
    let end = t.length;
    if (tgtIdx > eIdx) end = Math.min(end, tgtIdx);
    if (stopIdx > eIdx) end = Math.min(end, stopIdx);
    const prices = extractPrices(stripLabels(t.slice(eIdx, end)));
    if (prices.length >= 2) entry = (prices[0] + prices[1]) / 2;
    else if (prices.length === 1) entry = prices[0];
  }
  if (!Number.isFinite(entry)) {
    const paren = t.match(/\(([^)]*\d[^)]*)\)/);
    if (paren) {
      const prices = extractPrices(paren[1]);
      if (prices.length >= 2) entry = (prices[0] + prices[1]) / 2;
      else if (prices.length === 1) entry = prices[0];
    }
  }

  // דורש את כל הרכיבים, וכולם חיוביים (מסנן טעויות מקור כמו "$0.0.1429").
  if (!(entry > 0) || !(tp > 0) || !(sl > 0)) return null;

  // ולידציה לוגית של כיוון מול TP/SL (מסנן זבל).
  if (direction === 'LONG' && !(tp > entry && sl < entry)) return null;
  if (direction === 'SHORT' && !(tp < entry && sl > entry)) return null;

  return { coin, asset: `${coin}/USDT`, direction, entry, tp, sl };
}

// פיצול עמוד t.me/s ל-(postId, datetime, text) לכל הודעה.
function splitMessages(html) {
  const chunks = html.split('tgme_widget_message_wrap').slice(1);
  const out = [];
  for (const ch of chunks) {
    const idM = ch.match(/data-post="([^"]+)"/);
    const dtM = ch.match(/<time[^>]+datetime="([^"]+)"/);
    const txtM = ch.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!txtM) continue;
    out.push({
      postId: idM ? idM[1] : null,
      dateMs: dtM ? Date.parse(dtM[1]) : NaN,
      text: htmlToText(txtM[1]),
    });
  }
  return out;
}

/**
 * מושך ומפענח סיגנלים מערוץ. מחזיר מערך:
 * { postId, provider, asset, direction, entry, tp, sl, dateMs }
 */
export async function fetchChannelSignals(channel) {
  const handle = String(channel || '').replace(/[^A-Za-z0-9_]/g, '');
  const provider = TELEGRAM_CHANNELS[handle];
  if (!provider) throw new Error(`ערוץ לא מוכר: ${channel}`);

  const res = await fetch(`https://t.me/s/${handle}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TGM-bot)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`t.me ${res.status}`);
  const html = await res.text();

  const out = [];
  for (const msg of splitMessages(html)) {
    const sig = parseSignalText(msg.text);
    if (!sig) continue;
    if (!Number.isFinite(msg.dateMs)) continue;
    out.push({
      postId: msg.postId,
      provider,
      asset: sig.asset,
      direction: sig.direction,
      entry: +sig.entry.toFixed(8),
      tp: +sig.tp.toFixed(8),
      sl: +sig.sl.toFixed(8),
      dateMs: msg.dateMs,
    });
  }
  return out;
}
