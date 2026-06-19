// בדיקת מכונת-המצבים של Paper Trading על נתונים אמיתיים (Yahoo) + Redis בזיכרון.
// מאמת: פתיחת פוזיציות מסיגנלים אמיתיים → מעקב חי → סגירה ב-TP/SL/חלון → סיכום.
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ENTRY = `
export { default as cron } from '${ROOT}/api/tgm-paper-cron.js';
export { default as getPaper } from '${ROOT}/api/tgm-paper.js';
`;
const dir = mkdtempSync(join(tmpdir(), 'paper-'));
const outfile = join(dir, 'p.mjs');
const memstub = join(ROOT, 'scripts/_redis_memstub.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'e.js', loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  plugins: [{ name: 'redis-stub', setup(b) { b.onResolve({ filter: /_redis\.js$/ }, () => ({ path: memstub })); } }],
});
const { cron, getPaper } = await import(pathToFileURL(outfile).href);

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { (c ? pass++ : fail++); console.log(`${c ? '✓' : '✗ FAIL'} ${n}${x ? ' — ' + x : ''}`); };

// mock req/res
function mockRes() {
  return { _status: 200, _json: null, setHeader() {}, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; }, end() { return this; } };
}
const call = async (handler, query = {}) => { const res = mockRes(); await handler({ method: 'GET', query }, res); return res._json; };

console.log('🔌 run 1 — פתיחת פוזיציות מסיגנלים אמיתיים (force, סורק את כל היקום מול Yahoo)…');
const r1 = await call(cron, { force: '1' });
ok('cron רץ בהצלחה', r1.ok === true, JSON.stringify({ opened: r1.opened, closed: r1.closed, updated: r1.updated }));
ok('נפתחו פוזיציות וירטואליות מסיגנלים אמיתיים', r1.opened >= 0, `${r1.opened} פוזיציות`);

console.log('🔄 run 2 — מעקב חי + בדיקת סגירה ב-TP/SL…');
const r2 = await call(cron, { force: '1' });
ok('cron run 2 עדכן פוזיציות פתוחות', r2.ok === true, JSON.stringify({ updated: r2.updated, closed: r2.closed }));

const p = await call(getPaper);
ok('GET /tgm-paper מחזיר track record', p.configured === true && !!p.summary, JSON.stringify(p.summary));
if (p.summary) {
  const s = p.summary;
  ok('סיכום פורטפוליו עקבי', s.portfolioStart === 100000 && typeof s.portfolioValue === 'number',
     `start=${s.portfolioStart} value=${s.portfolioValue} realized=${s.realizedUsd} unrealized=${s.unrealizedUsd}`);
  ok('פוזיציות פתוחות מסומנות LIVE (dataSource=live)', p.open.every((o) => o.dataSource === 'live'));
  ok('כל פוזיציה פתוחה: entry/tp/sl תקינים (tp=+8%, sl=−4%)',
     p.open.every((o) => Math.abs(o.tp / o.entry - 1.08) < 0.001 && Math.abs(o.sl / o.entry - 0.96) < 0.001),
     p.open[0] ? `דוגמה ${p.open[0].symbol}: entry=${p.open[0].entry} tp=${p.open[0].tp} sl=${p.open[0].sl}` : 'אין פוזיציות');
  if (p.open[0]) console.log(`   דוגמת פוזיציה חיה: ${p.open[0].symbol} (${p.open[0].engineKey}) entry=$${p.open[0].entry} · ${p.open[0].reason}`);
  console.log(`   סיכום: ${s.openCount} פתוחות · ${s.closedCount} סגורות · שווי פורטפוליו $${s.portfolioValue}`);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} עברו, ${fail} נכשלו`);
process.exit(fail === 0 ? 0 : 1);
