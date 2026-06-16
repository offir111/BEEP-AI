// TGM · BreakoutEngine — מנוע פריצות.
// קריטריונים: פריצת שיא 52 שבועות או פריצת רמת התנגדות, עם נפח מאשר (RVol>1.5).
// כל המניות עוברות קודם את מסנן החברות האמיתיות ב-baseEngine.

import { scanUniverse } from './baseEngine';

const RVOL_CONFIRM = 1.5; // נפח מאשר מינימלי לפריצה אמינה

const BreakoutEngine = {
  key: 'breakout',
  label: 'פריצה',
  icon: '🚀',
  color: '#22c55e',
  signalType: 'breakout',
  description: 'פריצת שיא 52 שבועות או רמת התנגדות, עם נפח מאשר (RVol>1.5).',

  generateLeads(dateMs) {
    return scanUniverse(dateMs, 'BreakoutEngine', 'breakout', (stock, bar) => {
      const volConfirms = bar.relVolume > RVOL_CONFIRM;
      if (!volConfirms) return { ok: false };

      const breaks52w = bar.high >= bar.high52w && bar.close >= bar.high52w * 0.985;
      const breaksResistance = bar.close > bar.resistance && bar.high > bar.resistance;
      if (!(breaks52w || breaksResistance)) return { ok: false };

      const kind = breaks52w ? `שיא 52ש׳ ($${bar.high52w})` : `התנגדות ($${bar.resistance})`;
      return {
        ok: true,
        reason: `פריצת ${kind} · נפח מאשר ×${bar.relVolume}`,
        meta: { breaks52w, breaksResistance, high52w: bar.high52w, resistance: bar.resistance, relVolume: bar.relVolume },
      };
    });
  },
};

export default BreakoutEngine;
