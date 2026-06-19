// TGM · Compare — בדיקת חוסן רב-ספים (משימה 2).
// ════════════════════════════════════════════════════════════════════════════
// מריץ את *אותם לידים בדיוק* מול כמה ספי TP (ברירת מחדל 8% בסיס ו-10% בדיקה),
// כשה-SL ‎-4%‎ והחלון קבועים בכל הריצות. ה-TP **לא משתנה** במערכת — זו בדיקה בלבד:
// אם ה-edge חזק, מעבר ל-10% מוריד את ה-win-rate רק מעט; אם הוא שביר ("בקושי נגע
// ב-8%"), ה-win-rate צונח.
//
// כל ליד מוערך מחדש מאותו חלון forward (evaluateLeadMulti) → אותם נרות, רק סף שונה,
// כך שההשוואה הוגנת לחלוטין.
// ════════════════════════════════════════════════════════════════════════════

import { ENGINES } from './engines';
import { evaluateLeadMulti, TP_THRESHOLDS, SL_PCT, WINDOW_DAYS } from './evaluator';
import { computeStats } from './stats';

/**
 * מחזיר השוואה צד-לצד לכל מנוע + כולל, לכל סף.
 * leads: רשומות לידים (צריך symbol + timestamp + engineKey).
 * → {
 *     thresholds: [8,10], sl, windowDays,
 *     overall: { 8: stats, 10: stats },
 *     perEngine: [{ engineKey,label,icon,color, byTp: {8:stats,10:stats}, drop }]
 *   }
 *   drop = ירידת ה-win-rate מהסף הראשון לאחרון (נקודות אחוז), או null.
 */
export function compareThresholds(leads, thresholds = TP_THRESHOLDS, { sl = SL_PCT, windowDays = WINDOW_DAYS } = {}) {
  // לכל ליד — תוצאות לכל סף (מאותו חלון forward).
  const enriched = leads.map((l) => {
    const m = evaluateLeadMulti({ symbol: l.symbol, timestamp: l.timestamp }, thresholds, { sl, windowDays });
    return { engineKey: l.engineKey, timestamp: l.timestamp, multi: m };
  });

  const recordsForTp = (subset, tp) =>
    subset.map((e) => {
      const r = e.multi.results[tp];
      return r
        ? { status: r.status, pnlPct: r.pnlPct, timestamp: e.timestamp }
        : { status: 'open', pnlPct: null, timestamp: e.timestamp }; // לא ניתן להכרעה (טרי/חור)
    });

  const statsByTp = (subset) => {
    const out = {};
    for (const tp of thresholds) out[tp] = computeStats(recordsForTp(subset, tp));
    return out;
  };

  const overall = statsByTp(enriched);

  const perEngine = ENGINES.map((eng) => {
    const subset = enriched.filter((e) => e.engineKey === eng.key);
    const byTp = statsByTp(subset);
    const first = byTp[thresholds[0]].winRate;
    const last = byTp[thresholds[thresholds.length - 1]].winRate;
    const drop = first != null && last != null ? Math.round((first - last) * 100) / 100 : null;
    return { engineKey: eng.key, label: eng.label, icon: eng.icon, color: eng.color, byTp, drop };
  });

  return { thresholds, sl, windowDays, overall, perEngine };
}

/** פרשנות מילולית לחוסן ה-edge לפי גודל הירידה (נקודות אחוז). */
export function edgeVerdict(dropPP) {
  if (dropPP == null) return { text: 'אין מספיק נתונים', tone: 'dim' };
  if (dropPP <= 8) return { text: 'edge חזק ואמין', tone: 'good' };
  if (dropPP <= 20) return { text: 'edge בינוני', tone: 'mid' };
  return { text: 'edge שביר — הרווח ב-8% היה "בקושי"', tone: 'bad' };
}
