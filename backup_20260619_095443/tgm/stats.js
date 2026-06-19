// TGM · Stats — חישוב סטטיסטיקה + דירוג מנועים.
// ────────────────────────────────────────────────────────────────────────────
// תיקון הבאג הקריטי (חלק ד׳): אחוז ההצלחה (win-rate) מחושב אך ורק על טריידים
// שהוכרעו תקין (win/loss). לידים בסטטוס 'error':
//   • לעולם אינם נספרים כהצלחה.
//   • אינם נכללים במכנה של ה-win-rate.
// אם מספר הטריידים שהוכרעו = 0 → winRate הוא null ("אין מספיק נתונים"), לא 100%.
// אם מספר הטריידים שהוכרעו < MIN_SAMPLE → לא מציגים אחוז ("מדגם קטן מדי").
// ────────────────────────────────────────────────────────────────────────────

import { ENGINES } from './engines';

// מתחת לכמות הזו של טריידים שהוכרעו — לא מציגים אחוז הצלחה (מדגם קטן מדי).
export const MIN_SAMPLE_FOR_RATE = 10;

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * סטטיסטיקה לקבוצת לידים (מנוע בודד או כולם).
 * מחזיר:
 *   generated, succeeded(win), failed(loss), errored, resolved,
 *   winRate (null אם resolved=0), sampleTooSmall (resolved<MIN),
 *   avgReturn, profitFactor (null/Infinity), maxDrawdown
 */
export function computeStats(leads) {
  const generated = leads.length;
  const wins = leads.filter((l) => l.status === 'win');
  const losses = leads.filter((l) => l.status === 'loss');
  const errored = leads.filter((l) => l.status === 'error').length;
  const resolvedLeads = [...wins, ...losses];
  const resolved = resolvedLeads.length;

  // ── תיקון הליבה: win-rate רק על מה שהוכרע תקין ──
  const winRate = resolved > 0 ? r2((wins.length / resolved) * 100) : null;
  const sampleTooSmall = resolved < MIN_SAMPLE_FOR_RATE;

  // תשואה ממוצעת לליד (רק מוכרעים).
  const avgReturn =
    resolved > 0 ? r2(resolvedLeads.reduce((s, l) => s + (Number(l.pnlPct) || 0), 0) / resolved) : null;

  // Profit Factor = סך רווחים / |סך הפסדים|.
  const grossWin = wins.reduce((s, l) => s + (Number(l.pnlPct) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, l) => s + (Number(l.pnlPct) || 0), 0));
  let profitFactor = null;
  if (resolved > 0) {
    profitFactor = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : r2(grossWin / grossLoss);
  }

  // Max Drawdown על עקומת הון (סכום מצטבר של אחוזי תשואה, כרונולוגי).
  const maxDrawdown = computeMaxDrawdown(resolvedLeads);

  return {
    generated,
    succeeded: wins.length,
    failed: losses.length,
    errored,
    resolved,
    winRate,
    sampleTooSmall,
    avgReturn,
    profitFactor,
    maxDrawdown,
  };
}

// Max Drawdown (%) על פני עקומת ההון של הטריידים המוכרעים לפי סדר זמן.
function computeMaxDrawdown(resolvedLeads) {
  if (!resolvedLeads.length) return null;
  const ordered = [...resolvedLeads].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  for (const l of ordered) {
    equity += Number(l.pnlPct) || 0;
    if (equity > peak) peak = equity;
    const dd = peak - equity; // ירידה מהשיא, באחוזים מצטברים
    if (dd > maxDD) maxDD = dd;
  }
  return r2(maxDD);
}

/**
 * דירוג מנועים מהטוב לגרוע.
 * עבור כל מנוע: stats. דירוג רשמי רק למנועים עם resolved >= MIN_SAMPLE.
 * מיון: זכאים קודם (winRate↓, ואז profitFactor↓, ואז avgReturn↓), אחר כך לא-זכאים (resolved↓).
 */
export function rankEngines(leads) {
  const rows = ENGINES.map((eng) => {
    const engineLeads = leads.filter((l) => l.engineKey === eng.key);
    const stats = computeStats(engineLeads);
    return {
      engineKey: eng.key,
      label: eng.label,
      icon: eng.icon,
      color: eng.color,
      eligible: stats.resolved >= MIN_SAMPLE_FOR_RATE,
      ...stats,
    };
  });

  rows.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.eligible) {
      if ((b.winRate ?? -1) !== (a.winRate ?? -1)) return (b.winRate ?? -1) - (a.winRate ?? -1);
      const apf = a.profitFactor === Infinity ? 1e9 : a.profitFactor ?? -1;
      const bpf = b.profitFactor === Infinity ? 1e9 : b.profitFactor ?? -1;
      if (bpf !== apf) return bpf - apf;
      return (b.avgReturn ?? -1) - (a.avgReturn ?? -1);
    }
    return b.resolved - a.resolved;
  });

  let rank = 0;
  for (const row of rows) row.rank = row.eligible ? ++rank : null;
  return rows;
}

/** מסנן לידים לחודש מסוים (year, month 0-11) לפי timestamp. */
export function leadsForMonth(leads, year, month) {
  return leads.filter((l) => {
    const d = new Date(l.timestamp);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}

/** רשימת החודשים (year/month) שיש בהם לידים, מהחדש לישן. */
export function availableMonths(leads) {
  const set = new Map();
  for (const l of leads) {
    const d = new Date(l.timestamp);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (!set.has(key)) set.set(key, { year: d.getUTCFullYear(), month: d.getUTCMonth(), key });
  }
  return [...set.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
export function monthLabel(year, month) {
  return `${HE_MONTHS[month]} ${year}`;
}
