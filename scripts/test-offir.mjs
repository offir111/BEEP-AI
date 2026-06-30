// scripts/test-offir.mjs — headless unit tests for the +OFFIR engine.
// Run: node scripts/test-offir.mjs
import {
  sma, linregChannel, atrPercent, volumeSpike,
  analyzeOffir, mockCandles, resolveApiSymbol,
  isHotSector, scoreCatalyst, dipFromLocalHigh,
  MIN_MARKET_CAP, MIN_DIP_PCT,
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

// ── criterion 2: isHotSector ──
ok(isHotSector('Technology', 'Software', '').hot === true, 'Technology sector → hot');
ok(isHotSector('Financial', 'Capital Markets', 'Hut 8 AI/HPC compute').hot === true, 'crypto miner (capital markets + AI/HPC theme) → hot');
ok(isHotSector(null, null, 'Bitcoin spot ETF').hot === true, 'crypto ETF by theme → hot');
ok(isHotSector('Healthcare', 'Drug Manufacturers', 'generic pharma').hot === false, 'pharma → not hot');
ok(isHotSector(null, null, '').hot === null, 'no sector + no theme → unknown (null)');

// ── criterion 3: scoreCatalyst (basic NLP) ──
ok(scoreCatalyst('AI/HPC deal with Google cloud').positive === true, 'positive catalyst → positive');
ok(scoreCatalyst('').hasCatalyst === false, 'empty catalyst → hasCatalyst false');
ok(scoreCatalyst('').positive === null, 'empty catalyst → positive null (unknown, not pass)');
ok(scoreCatalyst('lawsuit, dilution and downgrade').positive === false, 'negative-only catalyst → not positive');
ok(scoreCatalyst('record growth partnership despite a lawsuit').positive === true, 'net-positive catalyst → positive');

// ── criterion 6: dipFromLocalHigh ──
const dipUp = Array.from({ length: 140 }, (_, i) => ({ high: 100, low: 90, close: i === 139 ? 75 : 100, volume: 1 }));
const dRes = dipFromLocalHigh(dipUp);
ok(approx(dRes.dipPct, 25), `dip 100→75 = 25% (got ${dRes.dipPct?.toFixed(1)})`);
ok(dRes.pass === true, 'dip 25% ≥ 20% → pass');
const shallow = Array.from({ length: 140 }, (_, i) => ({ high: 100, low: 90, close: i === 139 ? 90 : 100, volume: 1 }));
ok(dipFromLocalHigh(shallow).pass === false, 'dip 10% < 20% → fail');
ok(dipFromLocalHigh([]).pass === null, 'no candles → dip pass null');

// ── analyzeOffir: uptrend still near high → uptrend passes, dip fails → YELLOW ──
const closesUp = Array.from({ length: 210 }, (_, i) => 50 + i * 0.3 + Math.sin(i * 0.1) * 4);
const cndUp = closesUp.map((c, i) => ({ time: i, open: c, high: c + 2.5, low: c - 2.5, close: c, volume: 1e6 }));
const rUp = analyzeOffir(cndUp, {
  marketCap: 1e9, assetType: 'STOCK', sector: 'Technology', industry: 'Software',
  hint: 'Cipher Mining AI/HPC', catalyst: 'AI/HPC cloud deal',
});
ok(rUp.criteria.uptrend.pass === true, 'uptrend criterion passes (above SMA200 + slope up)');
ok(rUp.criteria.marketCap.pass === true, 'marketCap 1B passes ≥500M');
ok(rUp.criteria.hotSector.pass === true, 'Technology → hotSector passes');
ok(rUp.criteria.catalyst.pass === true, 'AI/HPC deal → catalyst passes');
ok(rUp.criteria.volatility.pass === true, 'volatility in 2–20% passes');
ok(rUp.status === 'yellow', `uptrend near high (no 20% dip) → yellow (got ${rUp.status}, dip ${rUp.dip.dipPct?.toFixed(1)}%)`);

// ── analyzeOffir: uptrend, spiked to a local high then returned to channel → GREEN ──
// steady uptrend + a hump (local high ~207) that fades; last close sits ~25% below
// that local high but still inside the trend channel (not a break).
const greenCloses = Array.from({ length: 210 }, (_, i) => 50 + i * 0.5 + 70 * Math.exp(-((i - 168) ** 2) / 10));
const cndGreen = greenCloses.map((c, i) => ({ time: i, open: c, high: c + 3, low: c - 3, close: c, volume: 1e6 }));
const rGreen = analyzeOffir(cndGreen, {
  marketCap: 2e9, sector: 'Technology', industry: 'Software', hint: 'x', catalyst: 'partnership deal',
});
ok(rGreen.criteria.dipFromHigh.pass === true, `dipped ≥20% from local high (got ${rGreen.dip.dipPct?.toFixed(1)}%)`);
ok(rGreen.criteria.uptrend.pass === true, 'green case still in yearly uptrend');
ok(rGreen.status === 'green', `uptrend + ≥20% dip → green (got ${rGreen.status})`);

// ── analyzeOffir: downtrend below SMA200 → RED ──
const cndDown = Array.from({ length: 210 }, (_, i) => {
  const c = 200 - i * 0.5;
  return { time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 1e6 };
});
const rDown = analyzeOffir(cndDown, { marketCap: 1e9 });
ok(rDown.status === 'red', `downtrend → red (got ${rDown.status})`);
ok(rDown.criteria.uptrend.pass === false, 'downtrend → uptrend criterion fails');

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

// ── catalyst missing → criterion unknown, never silently passes ──
const rNoCat = analyzeOffir(cndUp, { marketCap: 1e9, catalyst: '' });
ok(rNoCat.criteria.catalyst.unknown === true, 'empty catalyst → unknown flag');
ok(rNoCat.criteria.catalyst.pass === null, 'empty catalyst → pass=null (not silent pass)');

// ── mockCandles deterministic + analyzable ──
const m1 = mockCandles('CIFR'), m2 = mockCandles('CIFR');
ok(m1.length === 220 && m1[0].close === m2[0].close, 'mockCandles deterministic per ticker');
const rMock = analyzeOffir(m1, { marketCap: 7e8, sector: 'Technology' });
ok(['green', 'yellow', 'red'].includes(rMock.status), 'mock analyzable → valid status');

// ── no NaN/undefined leaks in criteria values ──
for (const [k, c] of Object.entries(rGreen.criteria)) {
  ok(!(typeof c.value === 'number' && Number.isNaN(c.value)), `criterion ${k} value is not NaN`);
}

// ── resolveApiSymbol alias + constants ──
ok(resolveApiSymbol('hut8') === 'HUT', 'HUT8 → HUT alias');
ok(resolveApiSymbol('cifr') === 'CIFR', 'CIFR → CIFR passthrough');
ok(MIN_MARKET_CAP === 500e6, 'MIN_MARKET_CAP = 500M');
ok(MIN_DIP_PCT === 20, 'MIN_DIP_PCT = 20');

console.log(`\n+OFFIR engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
