// בדיקת חוסן לוגיקה של TGM (MOCK, ללא רשת) — נבדק ב-Node ע"י bundling עם esbuild.
// מאמת: (1) כניסה נטולת look-ahead = open של D+1, (2) סדר SL/TP, (3) עקביות מתמטית
// של הסטטיסטיקה, (4) פיזור סיווג המגמה, (5) השוואת ספים 8% מול 10%.
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const ENTRY = `
export * as dataLayer from '${ROOT}/src/tgm/data/dataLayer.js';
export * as evaluator from '${ROOT}/src/tgm/evaluator.js';
export * as trend from '${ROOT}/src/tgm/trend.js';
export * as stats from '${ROOT}/src/tgm/stats.js';
export { ENGINES } from '${ROOT}/src/tgm/engines/index.js';
export { generateRound } from '${ROOT}/src/tgm/_genRound.js';
`;

// generateRound בלי localStorage (store תלוי בדפדפן) — עותק מינימלי לבדיקה.
writeFileSync(join(ROOT, 'src/tgm/_genRound.js'), `
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
`);

const dir = mkdtempSync(join(tmpdir(), 'tgm-'));
const outfile = join(dir, 'bundle.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'entry.js', loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile,
  alias: { '@capacitor/core': join(ROOT, 'scripts/_capacitor_stub.mjs') },
  logLevel: 'silent',
});

const M = await import(pathToFileURL(outfile).href);
const { dataLayer, evaluator, trend, stats, generateRound } = M;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

// עוגן זמן קבוע לדטרמיניזם.
const ANCHOR = Date.UTC(2026, 5, 19); // 2026-06-19
dataLayer.setMockAnchor(ANCHOR);

// ── 1) כניסה נטולת look-ahead: entry = open של D+1, לא open של יום הסיגנל ──
const signalDay = Date.UTC(2026, 3, 15); // יום מסחר היסטורי (בתוך חלון ה-MOCK)
const sigBar = dataLayer.getDailyBar('NVDA', signalDay);
const fwd = dataLayer.getForwardBars('NVDA', signalDay, 10);
ok('יש נר סיגנל ל-NVDA', !!sigBar, sigBar ? `close=${sigBar.close} _source=${sigBar._source}` : 'null');
ok('יש נרות forward אחרי הסיגנל', fwd.bars.length > 0, `${fwd.bars.length} נרות`);
if (sigBar && fwd.bars.length) {
  const lead = { symbol: 'NVDA', timestamp: signalDay, source: 'test', entry: sigBar.close };
  const ev = evaluator.evaluateLead(lead);
  ok('entry = open של D+1 (לא של יום הסיגנל)', ev.entry === Math.round(fwd.bars[0].o * 100) / 100,
     `entry=${ev.entry} D+1.open=${fwd.bars[0].o} signalDay.open=${sigBar.open}`);
  ok('הכניסה שונה מ-open של יום הסיגנל (אין look-ahead)', ev.entry !== sigBar.open || sigBar.open === fwd.bars[0].o);
}

// ── 2) סדר SL/TP: ביום שגם נגע ב-SL וגם ב-TP, ההכרעה לפי כיוון הסגירה ──
const upClose = evaluator.simulate(100, [{ o: 100, h: 110, l: 95, c: 105 }], { tp: 8, sl: 4 });
ok('יום עם TP+SL שנסגר למעלה → win', upClose.status === 'win', JSON.stringify(upClose));
const dnClose = evaluator.simulate(100, [{ o: 100, h: 110, l: 95, c: 97 }], { tp: 8, sl: 4 });
ok('יום עם TP+SL שנסגר למטה → loss', dnClose.status === 'loss', JSON.stringify(dnClose));
const slOnly = evaluator.simulate(100, [{ o: 100, h: 103, l: 95, c: 99 }], { tp: 8, sl: 4 });
ok('יום שנגע רק ב-SL → loss', slOnly.status === 'loss' && slOnly.pnlPct === -4);
const tpOnly = evaluator.simulate(100, [{ o: 100, h: 109, l: 99, c: 108 }], { tp: 8, sl: 4 });
ok('יום שנגע רק ב-TP → win', tpOnly.status === 'win' && tpOnly.pnlPct === 8);
// SL נבדק לפני TP בין ימים: יום 1 נוגע ב-SL → loss, גם אם יום 2 היה מזנק ל-TP.
const slFirstDay = evaluator.simulate(100, [{ o: 100, h: 101, l: 95, c: 96 }, { o: 96, h: 120, l: 96, c: 119 }], { tp: 8, sl: 4 });
ok('SL ביום 1 גובר על TP ביום 2 (סדר כרונולוגי נכון)', slFirstDay.status === 'loss' && slFirstDay.daysHeld === 1, JSON.stringify(slFirstDay));

// ── 3) ריצה היסטורית מלאה (MOCK) + עקביות מתמטית ──
const records = [];
let cur = new Date(ANCHOR);
let added = 0, guard = 0, skip = 0;
while (skip < 10 && guard < 40) { guard++; const d = cur.getUTCDay(); if (d !== 0 && d !== 6) skip++; cur = new Date(cur - 86400000); }
guard = 0;
while (added < 60 && guard < 140) {
  guard++; const d = cur.getUTCDay();
  if (d !== 0 && d !== 6) { records.push(...generateRound(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()))); added++; }
  cur = new Date(cur - 86400000);
}
ok('נוצרו לידים בריצה ההיסטורית', records.length > 50, `${records.length} לידים`);

for (const eng of ['breakout', 'momentum', 'catalyst', 'mna']) {
  const sub = records.filter((r) => r.engineKey === eng);
  const s = stats.computeStats(sub);
  const consistent = s.winRate == null || Math.abs((s.succeeded / s.resolved) * 100 - s.winRate) < 0.01;
  ok(`עקביות winRate=wins/resolved [${eng}]`, consistent,
     `gen=${s.generated} resolved=${s.resolved} win=${s.succeeded} loss=${s.failed} open=${s.pending} err=${s.errored} wr=${s.winRate}`);
  // אין ספירת error/open כהצלחה.
  ok(`error+open אינם נספרים ב-resolved [${eng}]`, s.resolved === s.succeeded + s.failed);
}

// ── 4) פיזור סיווג מגמה (לא הכול אותו צבע) ──
const tiers = {};
for (const r of records) tiers[r.trend.tier] = (tiers[r.trend.tier] || 0) + 1;
ok('סיווג המגמה מפוזר (יותר מקטגוריה אחת)', Object.keys(tiers).filter((k) => k !== 'unknown').length >= 2, JSON.stringify(tiers));
ok('מקור המגמה במצב MOCK מסומן mock', records.every((r) => r.trend.source === 'mock' || r.trend.tier === 'unknown'));

// ── 5) השוואת ספים 8% מול 10% על אותם לידים ──
const leadObjs = records.filter((r) => r.status !== 'error').map((r) => ({ symbol: r.symbol, timestamp: r.timestamp }));
let w8 = 0, w10 = 0, res8 = 0, res10 = 0;
for (const l of leadObjs) {
  const m = evaluator.evaluateLeadMulti(l, [8, 10]);
  if (!m.results[8]) continue;
  if (m.results[8].status === 'win' || m.results[8].status === 'loss') { res8++; if (m.results[8].status === 'win') w8++; }
  if (m.results[10].status === 'win' || m.results[10].status === 'loss') { res10++; if (m.results[10].status === 'win') w10++; }
}
ok('השוואת ספים מחזירה תוצאות לשני הספים', res8 > 0 && res10 > 0,
   `8%: ${w8}/${res8}=${(100 * w8 / res8).toFixed(1)}% · 10%: ${w10}/${res10}=${(100 * w10 / res10).toFixed(1)}%`);
ok('win-rate ב-10% ≤ win-rate ב-8% (יעד גבוה יותר = קשה יותר)', (w10 / res10) <= (w8 / res8) + 1e-9,
   `8%=${(100 * w8 / res8).toFixed(1)}% 10%=${(100 * w10 / res10).toFixed(1)}%`);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} עברו, ${fail} נכשלו`);
process.exit(fail === 0 ? 0 : 1);
