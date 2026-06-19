// TGM · CatalystEngine — מנוע קטליסטים (אירועים מהותיים).
// מקור: חדשות / הגשות 8-K / 13D / השקעות ענק / חוזים גדולים.
//
// ⚠️ אין כרגע מקור נתונים אמיתי מחובר — המנוע צורך אירועי MOCK ריאליסטיים
//    דרך ה-data layer (getCatalysts). הממשק מוכן לחיבור אמיתי.
//    TODO(real-data): לחבר ל-SEC EDGAR (8-K/13D), Benzinga / Finnhub news, Quiver.
//
// כל מניית-אירוע חייבת לעבור גם את מסנן החברות האמיתיות (שווי/מחיר/נפח).

import { getCatalysts, getDailyBar, getUniverse, passesUniverse } from '../data/dataLayer';
import { buildLead, dayStart } from './baseEngine';

const CatalystEngine = {
  key: 'catalyst',
  label: 'קטליסט',
  icon: '📰',
  color: '#3b82f6',
  signalType: 'catalyst',
  description: 'אירוע מהותי: חדשות, 8-K / 13D, השקעת ענק או חוזה גדול. (מקור MOCK — ממתין לחיבור API)',

  generateLeads(dateMs) {
    const ts = dayStart(dateMs);
    const universe = getUniverse();
    const leads = [];

    for (const ev of getCatalysts(ts)) {
      const stock = universe.find((s) => s.symbol === ev.symbol);
      if (!stock || !passesUniverse(stock)) continue; // חברה אמיתית בלבד
      const bar = getDailyBar(ev.symbol, ts);
      if (!bar) continue;
      // קטליסט הוא אירוע שורי — מתעלמים מימים שבהם השוק כבר תמחר אותו שלילית בחדות.
      if (bar.changePct <= -2.5) continue;
      leads.push(
        buildLead({
          symbol: ev.symbol,
          source: 'CatalystEngine',
          signalType: 'catalyst',
          timestamp: ts,
          reason: `${ev.type}: ${ev.reason}`,
          entry: bar.open,
          meta: { catalystType: ev.type, name: stock.name, sector: stock.sector, mock: true },
        })
      );
    }
    return leads;
  },
};

export default CatalystEngine;
