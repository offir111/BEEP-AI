// TGM · MomentumEngine — מנוע מומנטום.
// קריטריונים: ATR% > 5%, נפח יחסי (Relative Volume) > 2.5, שינוי יומי > ±5%.
// כל המניות עוברות קודם את מסנן החברות האמיתיות (שווי/מחיר/נפח) ב-baseEngine.

import { scanUniverse } from './baseEngine';

const ATR_MIN = 5;       // ATR% מינימלי
const RVOL_MIN = 2.5;    // נפח יחסי מינימלי
const CHANGE_MIN = 5;    // |שינוי יומי %| מינימלי

const MomentumEngine = {
  key: 'momentum',
  label: 'מומנטום',
  icon: '⚡',
  color: '#f59e0b',
  signalType: 'momentum',
  description: 'תנודתיות גבוהה (ATR%>5), נפח חריג (RVol>2.5) ושינוי יומי חד (>±5%).',

  generateLeads(dateMs) {
    return scanUniverse(dateMs, 'MomentumEngine', 'momentum', (stock, bar) => {
      const atrOk = bar.atrPct > ATR_MIN;
      const rvolOk = bar.relVolume > RVOL_MIN;
      const moveOk = Math.abs(bar.changePct) > CHANGE_MIN;
      if (!(atrOk && rvolOk && moveOk)) return { ok: false };
      return {
        ok: true,
        reason: `מומנטום: ATR ${bar.atrPct}% · RVol ×${bar.relVolume} · שינוי ${bar.changePct > 0 ? '+' : ''}${bar.changePct}%`,
        meta: { atrPct: bar.atrPct, relVolume: bar.relVolume, changePct: bar.changePct },
      };
    });
  },
};

export default MomentumEngine;
