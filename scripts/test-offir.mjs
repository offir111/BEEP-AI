// scripts/test-offir.mjs — headless unit tests for the +OFFIR engine.
// Run: node scripts/test-offir.mjs
import {
  sma, linregChannel, atrPercent, volumeSpike,
  analyzeOffir, mockCandles, resolveApiSymbol, MIN_MARKET_CAP,
} from '../src/engine/offirModel.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── sma ──
ok(sma([1, 2, 3, 4], 2) === 3.5, 'sma last-2 of [1,2,3,4] = 3.5');
ok(sma([1, 2], 5) === null, 'sma null when too few');

// ── linregChannel: perfect upward line → slope 1, std 0 ──
const line = Array.from({ length: 50 }, (_, i) => 10 + i);
const ch = linregChannel(line);
ok(approx(ch.slope, 1), 'regression slope of +1 line = 1');
ok(approx(ch.std, 0), 'std of perfect line = 0');
ok(ch.slope > 0, 'slope positive on uptrend');

// ── atrPercent: constant range → known % ──
const flat = Array.from({ length: 30 }, () => ({ open: 100, high: 102, low: 98, close: 100, volume: 1 }));
const atr = atrPercent(flat);
ok(approx(atr, 4, 1e-6), `atr% of 98-102 around 100 = 4% (got ${atr})`);

// ── volumeSpike: last 3x avg ──
const vc = Array.from({ length: 25 }, (_, i) => ({ open: 10, high: 11, low: 9, close: 10, volume: i === 24 ? 300 : 100 }));
ok(approx(volumeSpike(vc), 3), `volumeSpike = 3x (got ${volumeSpike(vc)})`);

// ── analyzeOffir: clean uptrend, price at lower channel → GREEN ──
// Build an uptrend then dip to the lower boundary on the last bar.
const closesUp = Array.from({ length: 210 }, (_, i) => 50 + i * 0.3 + Math.sin(i * 0.1) * 4);
const cndUp = closesUp.map((c, i) => ({ time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 1e6 }));
const rUp = analyzeOffir(cndUp, { marketCap: 1e9, assetType: 'STOCK' });
ok(rUp.criteria.aboveSMA200.pass === true, 'uptrend above SMA200');
ok(rUp.criteria.slopeUp.pass === true, 'uptrend slope positive');
ok(rUp.criteria.marketCap.pass === true, 'marketCap 1B passes ≥500M');
ok(['green', 'yellow'].includes(rUp.status), `valid uptrend → green/yellow (got ${rUp.status}, pos ${rUp.channelPos?.toFixed(1)})`);

// ── analyzeOffir: downtrend below SMA200 → RED ──
const cndDown = Array.from({ length: 210 }, (_, i) => {
  const c = 200 - i * 0.5;
  return { time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 1e6 };
});
const rDown = analyzeOffir(cndDown, { marketCap: 1e9 });
ok(rDown.status === 'red', `downtrend → red (got ${rDown.status})`);
ok(rDown.criteria.slopeUp.pass === false, 'downtrend slope negative');

// ── analyzeOffir: broke below lower channel → RED + brokeBelow ──
const cndBreak = closesUp.map((c, i) => ({ time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 1e6 }));
cndBreak[cndBreak.length - 1] = { time: 999, open: 40, high: 41, low: 10, close: 12, volume: 9e6 };
const rBreak = analyzeOffir(cndBreak, { marketCap: 1e9 });
ok(rBreak.brokeBelow === true, 'price below lower channel → brokeBelow');
ok(rBreak.status === 'red', `broke channel → red (got ${rBreak.status})`);

// ── marketCap unknown → not disqualifying (criterion unknown, not fail) ──
const rNoCap = analyzeOffir(cndUp, { marketCap: null });
ok(rNoCap.criteria.marketCap.unknown === true, 'null marketCap → unknown flag');
ok(rNoCap.criteria.marketCap.pass === null, 'null marketCap → pass=null (not false)');

// ── mockCandles deterministic + analyzable ──
const m1 = mockCandles('CIFR'), m2 = mockCandles('CIFR');
ok(m1.length === 220 && m1[0].close === m2[0].close, 'mockCandles deterministic per ticker');
const rMock = analyzeOffir(m1, { marketCap: 7e8 });
ok(['green', 'yellow', 'red'].includes(rMock.status), 'mock analyzable → valid status');

// ── resolveApiSymbol alias ──
ok(resolveApiSymbol('hut8') === 'HUT', 'HUT8 → HUT alias');
ok(resolveApiSymbol('cifr') === 'CIFR', 'CIFR → CIFR passthrough');
ok(MIN_MARKET_CAP === 500e6, 'MIN_MARKET_CAP = 500M');

console.log(`\n+OFFIR engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
