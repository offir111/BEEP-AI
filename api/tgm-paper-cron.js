// api/tgm-paper-cron.js — Paper Trading חי (מסחר נייר בזמן אמת, אפס כסף).
// ════════════════════════════════════════════════════════════════════════════
// רץ אוטומטית בענן (Vercel Cron) רק בשעות המסחר של וול-סטריט, גם כשהמחשב סגור.
// שכפול דפוס tgm-cron.js (Upstash Redis עמיד) + _tgmCheck.js (לוגיקת שרת).
//
// זרימה יומית:
//   1) בפתיחת המסחר (פעם ביום): סורק את היקום, פותח פוזיציה וירטואלית לכל סיגנל
//      (מחיר כניסה = המחיר האמיתי באותו רגע ≈ פתיחה), שומר ב-Redis.
//   2) כל טיק בשעות המסחר: מושך מחיר/שיא/שפל-יום אמיתי, סוגר אוטומטית ב-TP +8% /
//      SL −4%, או בתום חלון ה-forward (10 ימי מסחר) — אותו כלל כמו ה-backtest.
//   3) רישום ל-track record חי נפרד (LIVE PAPER) עם חותמות זמן אמיתיות.
//
// אחסון מתמיד חובה (serverless חסר state): Redis hash open/closed + meta.
// ════════════════════════════════════════════════════════════════════════════

import { redis } from './_redis.js';
import { clockStatus, isTradingDay, etTradingDay } from './_marketClock.js';
import { scanForSignals, fetchLiveQuote } from './_tgmPaperEngine.js';

const OPEN_KEY = 'tgm:paper:open';
const CLOSED_KEY = 'tgm:paper:closed';
const META_KEY = 'tgm:paper:meta';

const TP_PCT = 8, SL_PCT = 4, WINDOW_DAYS = 10;
const POSITION_USD = 5000;       // גודל פוזיציה אחיד
const PORTFOLIO_USD = 100000;    // פורטפוליו וירטואלי

const r2 = (n) => Math.round(n * 100) / 100;

// סופר ימי מסחר בין תאריך ET (YYYY-MM-DD) לבין עכשיו (כולל היום הנוכחי).
function tradingDaysSince(openYmd, now = new Date()) {
  const [y, m, d] = openYmd.split('-').map(Number);
  let cur = new Date(Date.UTC(y, m - 1, d, 16)); // צהריים ET בערך
  const end = now.getTime();
  let n = 0, guard = 0;
  while (cur.getTime() <= end && guard < 60) {
    guard++;
    if (isTradingDay(cur)) n++;
    cur = new Date(cur.getTime() + 86400000);
  }
  return Math.max(0, n - 1); // יום הפתיחה = 0 ימי אחזקה
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (!redis.isReady()) {
    return res.status(200).json({ ok: false, reason: 'Upstash Redis not configured (הגדר UPSTASH_REDIS_REST_URL/_TOKEN ב-Vercel)' });
  }

  const force = req.query?.force === '1' || req.query?.force === 'open';
  const clock = clockStatus();
  const report = { clock, opened: 0, closed: 0, updated: 0, skipped: null, errors: [] };

  try {
    let meta = (await redis.get(META_KEY)) || {};
    if (!meta.startedAt) { meta.startedAt = Date.now(); meta.startedEtDate = clock.etDate; }
    meta.lastCronAt = Date.now();

    // אם השוק סגור — לא פותחים/מעדכנים (אלא אם force לבדיקה).
    if (!clock.isOpen && !force) {
      report.skipped = `השוק סגור (${clock.session}, ${clock.etTime} ET) — אין פעולה`;
      await redis.set(META_KEY, meta);
      return res.status(200).json({ ok: true, ...report });
    }

    // ── 1) עדכון/סגירה של פוזיציות פתוחות ──
    const open = await redis.hgetall(OPEN_KEY);
    for (const [field, pos] of Object.entries(open)) {
      try {
        const q = await fetchLiveQuote(pos.symbol);
        if (!q) continue;
        report.updated++;
        const held = tradingDaysSince(pos.openDay);
        let close = null;

        if (q.dayHigh >= pos.tp) close = { exitReason: 'TP', exitPrice: pos.tp, pnlPct: TP_PCT };
        else if (q.dayLow <= pos.sl) close = { exitReason: 'SL', exitPrice: pos.sl, pnlPct: -SL_PCT };
        else if (held >= WINDOW_DAYS) {
          const pnl = ((q.price - pos.entry) / pos.entry) * 100;
          close = { exitReason: 'WINDOW', exitPrice: r2(q.price), pnlPct: r2(pnl) };
        }

        if (close) {
          const pnlUsd = r2(pos.shares * pos.entry * (close.pnlPct / 100));
          const closed = { ...pos, ...close, status: close.pnlPct >= 0 ? 'win' : 'loss',
            pnlUsd, daysHeld: held, closedAt: Date.now(), closedEtDate: clock.etDate };
          await redis.hset(CLOSED_KEY, field, closed);
          await redis.hdel(OPEN_KEY, field);
          report.closed++;
        } else {
          // עדכון מחיר אחרון (unrealized) — לתצוגה חיה.
          pos.lastPrice = r2(q.price);
          pos.lastPnlPct = r2(((q.price - pos.entry) / pos.entry) * 100);
          pos.daysHeld = held;
          pos.updatedAt = Date.now();
          await redis.hset(OPEN_KEY, field, pos);
        }
      } catch (e) {
        report.errors.push({ symbol: pos.symbol, error: String(e.message) });
      }
    }

    // ── 2) פתיחת פוזיציות חדשות — פעם ביום בלבד (בפתיחה) ──
    if ((meta.openedDay !== clock.etDate) || force) {
      const signals = await scanForSignals({ concurrency: 4 });
      const openNow = await redis.hgetall(OPEN_KEY);
      const heldSymbols = new Set(Object.values(openNow).map((p) => p.symbol));

      for (const s of signals) {
        if (heldSymbols.has(s.symbol)) continue; // לא פותחים כפל-פוזיציה לאותו סימבול
        const q = await fetchLiveQuote(s.symbol);
        if (!q || !(q.price > 0)) continue;
        const entry = r2(q.price);
        const shares = Math.max(1, Math.floor(POSITION_USD / entry));
        const id = `${s.symbol}|${clock.etDate}`;
        const pos = {
          id, symbol: s.symbol, name: s.name, engineKey: s.engineKey, signalType: s.signalType,
          reason: s.reason, entry, tp: r2(entry * (1 + TP_PCT / 100)), sl: r2(entry * (1 - SL_PCT / 100)),
          shares, sizeUsd: POSITION_USD, openedAt: Date.now(), openDay: clock.etDate,
          status: 'open', dataSource: 'live', lastPrice: entry, lastPnlPct: 0, daysHeld: 0,
        };
        await redis.hset(OPEN_KEY, id, pos);
        heldSymbols.add(s.symbol);
        report.opened++;
      }
      meta.openedDay = clock.etDate;
    }

    await redis.set(META_KEY, meta);
    res.status(200).json({ ok: true, ...report });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, ...report });
  }
}
