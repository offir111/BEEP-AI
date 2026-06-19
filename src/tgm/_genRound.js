
import { ENGINES } from './engines/index.js';
import { evaluateLead } from './evaluator.js';
import { classifyLeadTrend } from './trend.js';
export function generateRound(dateMs, cfg = {}) {
  const out = [];
  for (const eng of ENGINES) {
    for (const lead of (eng.generateLeads(dateMs) || [])) {
      const e = evaluateLead(lead, cfg);
      out.push({ ...e, engineKey: eng.key, trend: classifyLeadTrend(e.symbol, e.timestamp) });
    }
  }
  return out;
}
