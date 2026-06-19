// audit-compare.mjs — בדיקת חוסן 8% מול 10% על נתונים אמיתיים (משימה 2).
// דורש dev server רץ.
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ENTRY = `
export * as dataLayer from '${ROOT}/src/tgm/data/dataLayer.js';
export * as compare from '${ROOT}/src/tgm/compare.js';
export { ENGINES } from '${ROOT}/src/tgm/engines/index.js';
`;
const dir = mkdtempSync(join(tmpdir(), 'cmp-'));
const outfile = join(dir, 'c.mjs');
const liveApiBase = join(ROOT, 'scripts/_apibase_live.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'e.js', loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  plugins: [{ name: 'ab', setup(b) { b.onResolve({ filter: /utils\/apiBase$/ }, () => ({ path: liveApiBase })); } }],
});
const { dataLayer, compare, ENGINES } = await import(pathToFileURL(outfile).href);

console.log('🔌 טוען נתונים אמיתיים…');
await dataLayer.loadLiveData({ concurrency: 5 });

// בונה לידים אמיתיים מכל המנועים על פני ~200 ימים.
const DAY = 86400000, now = Date.now();
const leads = [];
for (let d = 220; d >= 15; d--) {
  const ts = now - d * DAY;
  for (const eng of ENGINES) for (const l of eng.generateLeads(ts)) leads.push({ ...l, engineKey: eng.key });
}
console.log(`   ${leads.length} לידים אמיתיים מכל המנועים.\n`);

const cmp = compare.compareThresholds(leads, [8, 10]);
const wr = (s) => (s.winRate == null ? 'אין מספיק' : s.winRate.toFixed(1) + '%');
const line = (name, byTp, drop) => {
  const v = compare.edgeVerdict(drop);
  console.log(
    `${name.padEnd(14)} | 8%: ${wr(byTp[8]).padStart(9)} (${String(byTp[8].succeeded).padStart(3)}/${String(byTp[8].resolved).padEnd(3)}) PF=${byTp[8].profitFactor}` +
    ` | 10%: ${wr(byTp[10]).padStart(9)} (${String(byTp[10].succeeded).padStart(3)}/${String(byTp[10].resolved).padEnd(3)}) PF=${byTp[10].profitFactor}` +
    ` | ירידה ${drop == null ? '—' : drop.toFixed(1) + 'pp'} → ${v.text}`
  );
};
console.log('═══ השוואת ספים — נתונים אמיתיים ═══');
const od = (() => { const a = cmp.overall[8].winRate, b = cmp.overall[10].winRate; return a != null && b != null ? a - b : null; })();
line('כל המנועים', cmp.overall, od);
for (const e of cmp.perEngine) line(`${e.icon} ${e.label}`, e.byTp, e.drop);

// בדיקות שפיות
let fail = 0;
for (const e of cmp.perEngine) {
  if (e.byTp[8].winRate != null && e.byTp[10].winRate != null && e.byTp[10].winRate > e.byTp[8].winRate + 1e-9) {
    console.log(`✗ ${e.label}: 10% גבוה מ-8% — לא אמור לקרות`); fail++;
  }
}
console.log(`\n${fail === 0 ? '✅' : '❌'} בדיקת מונוטוניות (10% ≤ 8%) ${fail === 0 ? 'עברה' : 'נכשלה'}`);
process.exit(fail === 0 ? 0 : 1);
