// TGM · Daily Evaluator — הליבה: הערכת תוצאה יומית לכל ליד.
// ────────────────────────────────────────────────────────────────────────────
// כלל הכניסה/יציאה (מתועד גם ב-README):
//   • כניסה (entry): מחיר הסיגנל ביום הליד = מחיר הפתיחה (open) של אותו יום.
//   • יציאה (exit):  take-profit +8%  /  stop-loss -4%, מה שנגע קודם באותו יום
//                    (נבדק מול ה-high/low התוך-יומיים של נר היציאה).
//                    אם אף יעד לא נגע עד סגירת היום → יציאה במחיר הסגירה (close).
//   • כל הלידים הם LONG (סיגנל שורי).
//   • הכרעת סדר (כשגם TP וגם SL בטווח התוך-יומי [low, high] של אותו נר): מאחר
//     שאין נתוני מסלול תוך-יומי, סדר הנגיעה נגזר מכיוון הסגירה — אם היום נסגר
//     מעל מחיר הכניסה מניחים שה-TP נפגע ראשון (win), אחרת ה-SL ראשון (loss).
//     אומדן ניטרלי וריאליסטי יותר מהנחת "SL תמיד ראשון".
//
// סטטוסים:
//   'win'   — הוכרע כרווח.
//   'loss'  — הוכרע כהפסד.
//   'error' — לא ניתן היה למשוך מחיר יציאה (חור נתונים / API). לא נספר כהצלחה,
//             ולא נכלל במכנה של חישוב ה-win-rate (ראה stats.js).
// ────────────────────────────────────────────────────────────────────────────

import { getExitBar } from './data/dataLayer';

export const TP_PCT = 8;   // take-profit +8%
export const SL_PCT = 4;   // stop-loss  -4%

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * מעריך ליד בודד מול נתוני היום שלו.
 * lead: { symbol, timestamp, entry, ... }
 * מחזיר רשומת ליד מועשרת: { ...lead, exitPrice, pnlPct, status, exitReason, error, evaluatedAt }
 */
export function evaluateLead(lead) {
  const entry = Number(lead.entry);
  const tp = entry * (1 + TP_PCT / 100);
  const sl = entry * (1 - SL_PCT / 100);

  const bar = getExitBar(lead.symbol, lead.timestamp);

  // ── מסלול שגיאה: אין מחיר יציאה ──
  if (!bar || !Number.isFinite(entry)) {
    const error = !Number.isFinite(entry) ? 'מחיר כניסה לא תקין' : 'אין נתון מחיר יציאה (חור ב-API)';
    logLead(lead, { entry, exitPrice: null, status: 'error', exitReason: 'no_exit_price', error });
    return { ...lead, exitPrice: null, pnlPct: null, status: 'error', exitReason: 'no_exit_price', error, evaluatedAt: timeNow() };
  }

  const hitTp = bar.high >= tp;
  const hitSl = bar.low <= sl;

  let status, exitPrice, exitReason, pnlPct;

  if (hitTp && hitSl) {
    // סדר הנגיעה נגזר מכיוון הסגירה (ראה תיעוד הכלל למעלה).
    if (bar.close >= entry) {
      status = 'win'; exitPrice = r2(tp); exitReason = 'TP'; pnlPct = TP_PCT;
    } else {
      status = 'loss'; exitPrice = r2(sl); exitReason = 'SL'; pnlPct = -SL_PCT;
    }
  } else if (hitTp) {
    status = 'win'; exitPrice = r2(tp); exitReason = 'TP'; pnlPct = TP_PCT;
  } else if (hitSl) {
    status = 'loss'; exitPrice = r2(sl); exitReason = 'SL'; pnlPct = -SL_PCT;
  } else {
    // לא נגע באף יעד — יציאה במחיר סגירה.
    exitPrice = r2(bar.close);
    pnlPct = r2(((bar.close - entry) / entry) * 100);
    exitReason = 'CLOSE';
    status = pnlPct >= 0 ? 'win' : 'loss';
  }

  logLead(lead, { entry, exitPrice, status, exitReason, pnlPct, error: null });
  return { ...lead, entry: r2(entry), exitPrice, pnlPct, status, exitReason, error: null, evaluatedAt: timeNow() };
}

// לוג ברור לכל ליד — entry, exit, status, סיבה/שגיאה (דרישת חלק ד׳).
function logLead(lead, { entry, exitPrice, status, exitReason, pnlPct, error }) {
  const tag = `[TGM ${lead.source || lead.engineKey || '?'}] ${lead.symbol}`;
  if (status === 'error') {
    console.warn(`${tag} · entry=${entry} · exit=— · status=ERROR · reason=${exitReason} · ${error}`);
  } else {
    console.log(`${tag} · entry=${entry} · exit=${exitPrice} · pnl=${pnlPct}% · status=${status.toUpperCase()} · ${exitReason}`);
  }
}

function timeNow() {
  // עוטף Date.now כדי לרכז את חותמת-הזמן במקום אחד.
  return Date.now();
}
