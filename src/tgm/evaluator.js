// TGM · Daily Evaluator — הליבה: סימולציית תוצאה לכל ליד על חלון קדימה (forward window).
// ════════════════════════════════════════════════════════════════════════════
// כלל הכניסה/יציאה (נטול look-ahead) — ראה גם TGM_BREAKOUT_AUDIT.md:
//   • הסיגנל מחושב מנתוני יום D (close/high/נפח של D — ידועים רק *בסוף* יום D).
//   • כניסה (entry): מחיר הפתיחה (open) של יום המסחר שאחרי הסיגנל (D+1).
//       ⮕ כך לא משתמשים בשום מחיר שלא היה זמין ברגע הכניסה (תיקון ה-look-ahead).
//   • יציאה (exit): סורקים יום-אחר-יום את חלון ה-forward (D+1 … D+window). בכל יום:
//       – אם ה-low נגע ב-SL (−4%) → הפסד.   – אם ה-high נגע ב-TP (+8%) → רווח.
//       – אם *שניהם* נגעו באותו יום (אין מסלול תוך-יומי) → הכרעה לפי כיוון הסגירה
//         של אותו יום (נסגר מעל הכניסה ⇒ TP ראשון/רווח, אחרת SL ראשון/הפסד).
//         זו ההנחה היחידה במודל; בין ימים הבדיקה מדויקת (SL נבדק לפני TP בכל יום).
//   • אם לא נגע באף יעד עד תום החלון → יציאה במחיר הסגירה של היום האחרון בחלון.
//   • כל הלידים LONG.
//
// סטטוסים:
//   'win'   — הוכרע כרווח (TP / סגירה חיובית בתום חלון).
//   'loss'  — הוכרע כהפסד (SL / סגירה שלילית בתום חלון).
//   'open'  — אין עדיין נרות אחרי הסיגנל (ליד טרי) / חור נתונים → לא הוכרע, לא נספר.
//   'error' — מחיר כניסה לא תקין.
//
// TP/SL ניתנים להגדרה (cfg) → תשתית לבדיקת חוסן רב-ספים (משימה 2). ברירת מחדל 8/4.
// ════════════════════════════════════════════════════════════════════════════

import { getForwardBars } from './data/dataLayer';

export const TP_PCT = 8;        // take-profit +8% (ברירת מחדל / בסיס)
export const SL_PCT = 4;        // stop-loss  -4% (קבוע)
export const WINDOW_DAYS = 10;  // חלון אחזקה מקסימלי (ימי מסחר)
export const TP_THRESHOLDS = [8, 10]; // ספי TP לבדיקת חוסן (משימה 2)

const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

/**
 * סימולציה טהורה על חלון נרות קדימה.
 * bars[0] = יום הכניסה (D+1); entry = bars[0].open. בודק SL לפני TP בכל יום.
 * מחזיר { status, exitPrice, exitReason, pnlPct, daysHeld }.
 */
export function simulate(entry, bars, { tp = TP_PCT, sl = SL_PCT } = {}) {
  const tpPrice = entry * (1 + tp / 100);
  const slPrice = entry * (1 - sl / 100);

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const hitTp = b.h >= tpPrice;
    const hitSl = b.l <= slPrice;

    if (hitTp && hitSl) {
      // שניהם באותו יום — הכרעה לפי כיוון הסגירה (ההנחה היחידה במודל).
      if (b.c >= entry) return { status: 'win', exitPrice: r2(tpPrice), exitReason: 'TP', pnlPct: tp, daysHeld: i + 1 };
      return { status: 'loss', exitPrice: r2(slPrice), exitReason: 'SL', pnlPct: -sl, daysHeld: i + 1 };
    }
    if (hitTp) return { status: 'win', exitPrice: r2(tpPrice), exitReason: 'TP', pnlPct: tp, daysHeld: i + 1 };
    if (hitSl) return { status: 'loss', exitPrice: r2(slPrice), exitReason: 'SL', pnlPct: -sl, daysHeld: i + 1 };
  }

  // חלון הסתיים בלי נגיעה — יציאה בסגירה האחרונה.
  const last = bars[bars.length - 1];
  const pnl = ((last.c - entry) / entry) * 100;
  return { status: pnl >= 0 ? 'win' : 'loss', exitPrice: r2(last.c), exitReason: 'WINDOW', pnlPct: r2(pnl), daysHeld: bars.length };
}

/**
 * מעריך ליד בודד מול חלון ה-forward שלו.
 * lead: { symbol, timestamp(signal day), ... }
 * cfg:  { tp, sl, windowDays }
 */
export function evaluateLead(lead, cfg = {}) {
  const tp = cfg.tp ?? TP_PCT;
  const sl = cfg.sl ?? SL_PCT;
  const windowDays = cfg.windowDays ?? WINDOW_DAYS;

  const { bars, source } = getForwardBars(lead.symbol, lead.timestamp, windowDays);

  if (!bars.length) {
    // אין נרות אחרי הסיגנל — ליד טרי / חור נתונים. לא מוכרע (לא נספר כהצלחה/כישלון).
    logLead(lead, { entry: null, exitPrice: null, status: 'open', exitReason: 'no_forward', error: 'אין עדיין נרות אחרי הסיגנל' });
    return { ...lead, entry: null, exitPrice: null, pnlPct: null, status: 'open', exitReason: 'no_forward',
      error: 'אין עדיין נרות אחרי הסיגנל (ליד טרי / חור נתונים)', daysHeld: 0, dataSource: source, evaluatedAt: timeNow() };
  }

  const entry = r2(bars[0].o);
  if (!Number.isFinite(entry)) {
    logLead(lead, { entry, exitPrice: null, status: 'error', exitReason: 'bad_entry', error: 'מחיר כניסה לא תקין' });
    return { ...lead, entry: null, exitPrice: null, pnlPct: null, status: 'error', exitReason: 'bad_entry',
      error: 'מחיר כניסה לא תקין', daysHeld: 0, dataSource: source, evaluatedAt: timeNow() };
  }

  const sim = simulate(entry, bars, { tp, sl });
  logLead(lead, { entry, exitPrice: sim.exitPrice, status: sim.status, exitReason: sim.exitReason, pnlPct: sim.pnlPct, error: null });
  return { ...lead, entry, exitPrice: sim.exitPrice, pnlPct: sim.pnlPct, status: sim.status,
    exitReason: sim.exitReason, daysHeld: sim.daysHeld, error: null, dataSource: source, evaluatedAt: timeNow() };
}

/**
 * מעריך אותו ליד מול כמה ספי TP (אותו חלון forward, אותו SL) — תשתית משימה 2.
 * מחזיר { entry, source, results: { [tp]: { status, exitPrice, pnlPct, exitReason, daysHeld } } }
 * (results ריק אם הליד עדיין לא ניתן להכרעה).
 */
export function evaluateLeadMulti(lead, thresholds = TP_THRESHOLDS, { sl = SL_PCT, windowDays = WINDOW_DAYS } = {}) {
  const { bars, source } = getForwardBars(lead.symbol, lead.timestamp, windowDays);
  if (!bars.length) return { entry: null, source, results: {} };
  const entry = r2(bars[0].o);
  if (!Number.isFinite(entry)) return { entry: null, source, results: {} };
  const results = {};
  for (const tp of thresholds) results[tp] = simulate(entry, bars, { tp, sl });
  return { entry, source, results };
}

function logLead(lead, { entry, exitPrice, status, exitReason, pnlPct, error }) {
  const tag = `[TGM ${lead.source || lead.engineKey || '?'}] ${lead.symbol}`;
  if (status === 'error' || status === 'open') {
    console.warn(`${tag} · entry=${entry ?? '—'} · status=${status.toUpperCase()} · ${exitReason} · ${error || ''}`);
  } else {
    console.log(`${tag} · entry=${entry} · exit=${exitPrice} · pnl=${pnlPct}% · ${status.toUpperCase()} · ${exitReason}`);
  }
}

function timeNow() { return Date.now(); }
