// TGM · Base Engine — תשתית משותפת לכל מנועי הלידים.
// כל מנוע מייצא אובייקט עם הממשק האחיד:
//   { key, label, icon, color, signalType, description, generateLeads(dateMs) }
// generateLeads(dateMs) → [ { symbol, source, signalType, timestamp, reason, entry, meta } ]
//
// השדות symbol/source/signalType/timestamp/reason הם הליבה (לפי המפרט);
// entry (מחיר הסיגנל באותו יום) ו-meta נוספים כי המעריך זקוק להם.

import { getFilteredUniverse, getDailyBar } from '../data/dataLayer';

// תאריך → תחילת היום (UTC) במ"ש, כדי שכל הלידים של אותו יום יחלקו timestamp.
export function dayStart(dateMs) {
  const d = new Date(dateMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// בונה ליד אחיד. entry = מחיר הסיגנל באותו יום (close של נר היום).
export function buildLead({ symbol, source, signalType, timestamp, reason, entry, meta }) {
  return { symbol, source, signalType, timestamp, reason, entry, meta: meta || {} };
}

// מריץ predicate על כל היקום המסונן עבור היום, ומחזיר לידים.
// fn(stock, bar) → { ok: boolean, reason?: string, meta?: object }
export function scanUniverse(dateMs, source, signalType, fn) {
  const ts = dayStart(dateMs);
  const leads = [];
  for (const stock of getFilteredUniverse()) {
    const bar = getDailyBar(stock.symbol, ts);
    if (!bar) continue; // אין נתון יומי — אין סיגנל (חור הנתונים מטופל בהערכה)
    const verdict = fn(stock, bar);
    if (verdict && verdict.ok) {
      leads.push(
        buildLead({
          symbol: stock.symbol,
          source,
          signalType,
          timestamp: ts,
          reason: verdict.reason,
          entry: bar.open, // כניסה במחיר הפתיחה של יום הסיגנל; יציאה עד סגירת היום
          meta: { ...verdict.meta, name: stock.name, sector: stock.sector },
        })
      );
    }
  }
  return leads;
}
