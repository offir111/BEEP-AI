// בדיקת אינטגרציה LIVE — מוודאת ש-TGM באמת מושך נתונים אמיתיים (Yahoo /api/candles)
// ומריץ עליהם את כל הפייפליין (העשרת נרות → מנועים → סיווג מגמה). דורש dev server רץ.
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ENTRY = `
export * as dataLayer from '${ROOT}/src/tgm/data/dataLayer.js';
export * as trend from '${ROOT}/src/tgm/trend.js';
export { ENGINES } from '${ROOT}/src/tgm/engines/index.js';
`;
const dir = mkdtempSync(join(tmpdir(), 'tgmlive-'));
const outfile = join(dir, 'bundle.mjs');
const liveApiBase = join(ROOT, 'scripts/_apibase_live.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'entry.js', loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile,
  logLevel: 'silent',
  plugins: [{
    name: 'apibase-live',
    setup(b) {
      b.onResolve({ filter: /utils\/apiBase$/ }, () => ({ path: liveApiBase }));
    },
  }],
});
const { dataLayer, trend } = await import(pathToFileURL(outfile).href);

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { (c ? pass++ : fail++); console.log(`${c ? '✓' : '✗ FAIL'} ${n}${x ? ' — ' + x : ''}`); };

console.log('🔌 טוען נתונים אמיתיים מ-/api/candles…');
const res = await dataLayer.loadLiveData({ concurrency: 5 });
ok('נטענו סימבולים חיים', res.ok > 10, `${res.ok}/${res.total} הצליחו`);
ok('מצב הנתונים = live/partial', ['live', 'partial'].includes(dataLayer.dataMode()), dataLayer.dataMode());

// נר אמיתי לסימבול
const asOf = Date.now();
const series = dataLayer.getDailySeries('AAPL', asOf);
ok('סדרת מגמה אמיתית ל-AAPL', !!series && series.source === 'live', series ? `${series.closes.length} ימים, source=${series.source}` : 'null');
if (series) {
  ok('יש SMA50/SMA200 אמיתיים', series.sma50 != null && series.sma200 != null, `sma50=${series.sma50?.toFixed(2)} sma200=${series.sma200?.toFixed(2)}`);
  const cl = trend.classifyTrend(series);
  ok('סיווג מגמה ל-AAPL ממקור live', cl.source === 'live', `${cl.tier} · ${cl.label} · ret=${cl.metrics?.annualReturnPct}%`);
}

// סיווג מגמה לכמה סימבולים אמיתיים — ציפייה לפיזור
const syms = ['AAPL', 'NVDA', 'TSLA', 'AMD', 'PLTR', 'INTC', 'PFE', 'F', 'SOFI', 'MARA'];
const out = [];
for (const s of syms) {
  const ser = dataLayer.getDailySeries(s, asOf);
  const cl = trend.classifyTrend(ser);
  out.push(`${s}:${trend.TREND_TIERS[cl.tier].emoji}${cl.metrics?.annualReturnPct != null ? `(${cl.metrics.annualReturnPct}%)` : ''}`);
}
console.log('  מגמות אמיתיות:', out.join('  '));
ok('סווגו מגמות אמיתיות למספר מניות', out.length === syms.length);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} עברו, ${fail} נכשלו`);
process.exit(fail === 0 ? 0 : 1);
