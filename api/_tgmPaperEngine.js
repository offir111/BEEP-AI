// api/_tgmPaperEngine.js — לוגיקת צד-שרת ל-Paper Trading (helper, לא route).
// ────────────────────────────────────────────────────────────────────────────
// משכפל את דפוס _tgmCheck.js: לוגיקה שרצה גם בענן (Vercel cron) ללא דפדפן.
// • מושך נרות יומיים אמיתיים (Yahoo v8 — אותו מקור כמו api/candles.js).
// • מזהה סיגנלים (פריצה / מומנטום) על הנר האחרון — *משקף* את מנועי הלקוח.
// • מושך מחיר/שיא/שפל-יום נוכחיים לבדיקת TP/SL חי.
// שימוש חוזר במתמטיקה הטהורה (seriesMath) וברשימת היקום (mockMarketData) — אין דריפט.
// ────────────────────────────────────────────────────────────────────────────

import { STOCK_UNIVERSE } from '../src/tgm/data/universe.js';
import { enrichBar, indexForDay } from '../src/tgm/data/seriesMath.js';

// סף היקום (זהה ל-dataLayer.passesUniverse).
const passesUniverse = (s) => s.marketCapM > 500 && s.price > 3 && s.avgVolM > 1;
export const PAPER_UNIVERSE = STOCK_UNIVERSE.filter(passesUniverse).map((s) => ({ symbol: s.symbol, name: s.name }));

// ספי הסיגנלים — משקפים את BreakoutEngine / MomentumEngine בלקוח.
const RVOL_BREAKOUT = 1.5, RVOL_MOMENTUM = 2.5, ATR_MIN = 5, CHANGE_MIN = 5;

const YH = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9', Referer: 'https://finance.yahoo.com',
};

// ── סדרת נרות יומית לשנה (אותו דפוס כמו candles.js) ─────────────────────────
export async function fetchDailySeries(symbol) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`,
        { headers: YH, signal: AbortSignal.timeout(9000) });
      if (!r.ok) continue;
      const data = await r.json();
      const res = data?.chart?.result?.[0];
      const ts = res?.timestamp, q = res?.indicators?.quote?.[0];
      if (!ts || !q) continue;
      const series = ts.map((t, i) => ({
        t: t * 1000, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i], v: q.volume?.[i] ?? 0, symbol,
      })).filter((b) => Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c));
      if (series.length >= 30) return series;
    } catch { /* host הבא */ }
  }
  return null;
}

// ── מחיר/שיא/שפל-יום נוכחיים (לבדיקת TP/SL חי) ─────────────────────────────
export async function fetchLiveQuote(symbol) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        { headers: YH, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const m = (await r.json())?.chart?.result?.[0]?.meta;
      if (!m) continue;
      const price = m.regularMarketPrice ?? m.previousClose ?? null;
      if (price == null) return null;
      return {
        price,
        dayHigh: m.regularMarketDayHigh ?? price,
        dayLow: m.regularMarketDayLow ?? price,
        marketState: m.marketState || 'CLOSED',
      };
    } catch { /* host הבא */ }
  }
  return null;
}

// ── זיהוי סיגנל על הנר האחרון בסדרה (משקף את מנועי הלקוח) ───────────────────
export function detectSignal(series) {
  const idx = series.length - 1;
  const bar = enrichBar(series, idx, 'live');
  if (!bar) return null;

  // פריצה
  if (bar.relVolume > RVOL_BREAKOUT) {
    const breaks52w = bar.high52w != null && bar.high >= bar.high52w && bar.close >= bar.high52w * 0.985;
    const breaksRes = bar.resistance != null && bar.close > bar.resistance && bar.high > bar.resistance;
    if (breaks52w || breaksRes) {
      const kind = breaks52w ? `שיא 52ש׳ ($${bar.high52w})` : `התנגדות ($${bar.resistance})`;
      return { signalType: 'breakout', engineKey: 'breakout', reason: `פריצת ${kind} · נפח ×${bar.relVolume}`, bar };
    }
  }
  // מומנטום
  if (bar.atrPct > ATR_MIN && bar.relVolume > RVOL_MOMENTUM && Math.abs(bar.changePct) > CHANGE_MIN) {
    return { signalType: 'momentum', engineKey: 'momentum', reason: `מומנטום: ATR ${bar.atrPct}% · RVol ×${bar.relVolume} · שינוי ${bar.changePct > 0 ? '+' : ''}${bar.changePct}%`, bar };
  }
  return null;
}

// סורק את כל היקום ומחזיר את הסיגנלים של היום (לפתיחת פוזיציות).
export async function scanForSignals({ concurrency = 4 } = {}) {
  const list = PAPER_UNIVERSE;
  const out = [];
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const { symbol, name } = list[cursor++];
      try {
        const series = await fetchDailySeries(symbol);
        if (!series) continue;
        const sig = detectSignal(series);
        if (sig) out.push({ symbol, name, signalType: sig.signalType, engineKey: sig.engineKey, reason: sig.reason, refClose: sig.bar.close });
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

export { indexForDay };
