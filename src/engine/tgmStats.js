// TGM — חישוב טבלת הדירוג מתוך הלידים שנבדקו.
import { TGM_PROVIDERS, MIN_TRADES_FOR_RANK } from './tgmProviders';

/**
 * מקבל מערך לידים, מחזיר שורות מסכמות לכל ספק, ממוינות לפי אחוז הצלחה.
 * רק לידים שנבדקו (status 'win'/'loss') נספרים כטריידים.
 * ספק עם פחות מ-MIN_TRADES_FOR_RANK טריידים → "מדגם לא מספיק", ללא דירוג רשמי.
 */
export function buildRanking(leads) {
  const byProvider = new Map();
  for (const name of TGM_PROVIDERS) {
    byProvider.set(name, { provider: name, trades: 0, wins: 0 });
  }

  for (const lead of leads) {
    if (lead.status !== 'win' && lead.status !== 'loss') continue;
    const row = byProvider.get(lead.provider);
    if (!row) continue; // מתעלם מספק שאינו ברשימה הקבועה
    row.trades += 1;
    if (lead.status === 'win') row.wins += 1;
  }

  const rows = [...byProvider.values()].map((r) => ({
    ...r,
    successRate: r.trades > 0 ? (r.wins / r.trades) * 100 : 0,
    eligible: r.trades >= MIN_TRADES_FOR_RANK,
  }));

  // מיון: קודם זכאים לדירוג (לפי אחוז הצלחה יורד, ואז מספר טריידים),
  // אחר כך לא-זכאים (לפי מספר טריידים יורד).
  rows.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.eligible) {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return b.trades - a.trades;
    }
    return b.trades - a.trades;
  });

  // הקצאת דירוג רשמי רק לזכאים.
  let rank = 0;
  for (const row of rows) {
    row.rank = row.eligible ? ++rank : null;
  }

  return rows;
}
