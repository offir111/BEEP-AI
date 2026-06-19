// TGM · MnaEngine — מנוע מיזוגים ורכישות (Merger Arbitrage).
// מקור: שמועות / הכרזות מיזוג ורכישה, הצעות רכש, צבירת נתח אסטרטגי.
//
// ⚠️ אין כרגע פיד M&A אמיתי מחובר — המנוע צורך אירועי MOCK ריאליסטיים
//    דרך ה-data layer (getMnaEvents). הממשק מוכן לחיבור אמיתי.
//    TODO(real-data): לחבר לפיד M&A (Bloomberg/Reuters rumors, SEC merger filings).
//
// כל מניית-אירוע חייבת לעבור גם את מסנן החברות האמיתיות (שווי/מחיר/נפח).

import { getMnaEvents, getDailyBar, getUniverse, passesUniverse } from '../data/dataLayer';
import { buildLead, dayStart } from './baseEngine';

const MnaEngine = {
  key: 'mna',
  label: 'M&A',
  icon: '🤝',
  color: '#a855f7',
  signalType: 'mna',
  description: 'שמועות/הכרזות מיזוג ורכישה, הצעות רכש וצבירת נתח (merger arbitrage). (מקור MOCK — ממתין לחיבור API)',

  generateLeads(dateMs) {
    const ts = dayStart(dateMs);
    const universe = getUniverse();
    const leads = [];

    for (const ev of getMnaEvents(ts)) {
      const stock = universe.find((s) => s.symbol === ev.symbol);
      if (!stock || !passesUniverse(stock)) continue; // חברה אמיתית בלבד
      const bar = getDailyBar(ev.symbol, ts);
      if (!bar) continue;
      // עסקת M&A היא אירוע שורי חזק (פרמיה למחיר) — מתעלמים מימים יורדים מובהקים.
      if (bar.changePct <= -0.5) continue;
      leads.push(
        buildLead({
          symbol: ev.symbol,
          source: 'MnaEngine',
          signalType: 'mna',
          timestamp: ts,
          reason: `${ev.type}: ${ev.reason}`,
          entry: bar.open,
          meta: { mnaType: ev.type, premiumPct: ev.premiumPct, name: stock.name, sector: stock.sector, mock: true },
        })
      );
    }
    return leads;
  },
};

export default MnaEngine;
