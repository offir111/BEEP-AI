// audit-breakout.mjs — אודיט מנוע "פריצה" על נתונים אמיתיים (משימה 1).
// מודד: (א) מספרים אמיתיים מתוך סימולציה, (ב) עקביות מתמטית, (ג) השפעת תיקון
// ה-look-ahead — השוואת win-rate בין השיטה הבאגית (כניסה ב-open של יום הסיגנל,
// יציאה באותו יום) לבין השיטה הנכונה (כניסה ב-D+1, חלון forward).
// דורש dev server רץ. Usage: node scripts/audit-breakout.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ENTRY = `
export * as dataLayer from '${ROOT}/src/tgm/data/dataLayer.js';
export * as evaluator from '${ROOT}/src/tgm/evaluator.js';
export * as stats from '${ROOT}/src/tgm/stats.js';
export { default as Breakout } from '${ROOT}/src/tgm/engines/BreakoutEngine.js';
`;
const dir = mkdtempSync(join(tmpdir(), 'bk-'));
const outfile = join(dir, 'b.mjs');
const liveApiBase = join(ROOT, 'scripts/_apibase_live.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'e.js', loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  plugins: [{ name: 'ab', setup(b) { b.onResolve({ filter: /utils\/apiBase$/ }, () => ({ path: liveApiBase })); } }],
});
const { dataLayer, evaluator, stats, Breakout } = await import(pathToFileURL(outfile).href);

console.log('🔌 טוען נתונים אמיתיים…');
const res = await dataLayer.loadLiveData({ concurrency: 5 });
console.log(`   ${res.ok}/${res.total} סימבולים LIVE\n`);

// אוסף לידי פריצה על פני ~200 ימים (משאיר חלון forward בסוף).
const DAY = 86400000;
const now = Date.now();
const leads = [];
for (let d = 220; d >= 15; d--) {
  const ts = now - d * DAY;
  for (const lead of Breakout.generateLeads(ts)) leads.push(lead);
}
console.log(`🚀 מנוע פריצה ייצר ${leads.length} לידים על נתונים אמיתיים.\n`);

// (1) שיטה נכונה — כניסה ב-D+1, חלון forward (המעריך החדש).
const evalCorrect = leads.map((l) => evaluator.evaluateLead(l));
const sC = stats.computeStats(evalCorrect);

// (2) שיטה באגית (לשם השוואה בלבד) — כניסה ב-open של יום הסיגנל, יציאה באותו יום,
//     הכרעה רק לפי close (מה ש"היה" מנפח). מדמה את החשד מספר 1 שבמשימה.
function buggySameDay(lead) {
  const bar = dataLayer.getDailyBar(lead.symbol, lead.timestamp);
  if (!bar) return { status: 'error' };
  const entry = bar.open;
  const tp = entry * 1.08, sl = entry * 0.96;
  const hitTp = bar.high >= tp, hitSl = bar.low <= sl;
  // הבאג הקלאסי: סופר ניצחון ברגע נגיעה ב-+8% בלי לבדוק שלא נגע קודם ב-SL.
  if (hitTp) return { status: 'win', pnlPct: 8 };
  if (hitSl) return { status: 'loss', pnlPct: -4 };
  const pnl = ((bar.close - entry) / entry) * 100;
  return { status: pnl >= 0 ? 'win' : 'loss', pnlPct: pnl };
}
const evalBuggy = leads.map(buggySameDay);
const sB = stats.computeStats(evalBuggy);

const wr = (s) => (s.winRate == null ? 'אין מספיק' : s.winRate.toFixed(1) + '%');
console.log('═══ השוואת שיטות הערכה (אותם לידי פריצה אמיתיים) ═══');
console.log(`באגית  (כניסה=open יום הסיגנל, TP נספר לפני בדיקת SL): win-rate ${wr(sB)}  (${sB.succeeded}/${sB.resolved})`);
console.log(`נכונה  (כניסה=open D+1, חלון forward, SL נבדק לפני TP):  win-rate ${wr(sC)}  (${sC.succeeded}/${sC.resolved})`);
console.log(`        pending(טרי)=${sC.pending} · errored=${sC.errored}`);
console.log(`        PF=${sC.profitFactor === Infinity ? '∞' : sC.profitFactor} · תשואה/ליד=${sC.avgReturn}% · MaxDD=${sC.maxDrawdown}%\n`);

// (3) עקביות מתמטית.
let bad = 0;
if (sC.winRate != null && Math.abs((sC.succeeded / sC.resolved) * 100 - sC.winRate) > 0.01) bad++;
if (sC.resolved !== sC.succeeded + sC.failed) bad++;
if (sC.generated !== evalCorrect.length) bad++;
console.log(`✓ עקביות: winRate=wins/resolved, resolved=win+loss, generated=#leads → ${bad === 0 ? 'תקין' : 'בעיה!'}`);
console.log(`✓ כל הלידים עברו סימולציה: ${evalCorrect.length}/${leads.length}`);
console.log(`✓ אין NaN ב-pnl: ${evalCorrect.every((e) => e.pnlPct == null || Number.isFinite(e.pnlPct)) ? 'תקין' : 'נמצא NaN!'}`);
process.exit(0);
