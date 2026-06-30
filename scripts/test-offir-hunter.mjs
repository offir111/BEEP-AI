// scripts/test-offir-hunter.mjs — headless tests for the +OFFIR Hunter (Stage 2).
// Run: node scripts/test-offir-hunter.mjs
import {
  HUNTER, passesPrefilter, huntPrefilter,
  trendComponent, dipComponent, volComponent, convictionScore,
  isSafeEntry, buildCandidate, rankCandidates,
} from '../src/engine/offirHunter.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const approx = (a, b, e = 0.01) => Math.abs(a - b) <= e;

// ── passesPrefilter: inverse logic = strong year + dipping + big cap ──
const good = { symbol: 'AAA', pct_1y: 80, market_cap: 2e9, chg1d: -3, pct_1w: -5 };
ok(passesPrefilter(good).ok === true, 'strong-year + dip + big-cap → passes');

ok(passesPrefilter({ ...good, pct_1y: 5 }).ok === false, 'weak year (5%) → rejected');
ok(passesPrefilter({ ...good, market_cap: 100e6 }).ok === false, 'cap < 500M → rejected');
ok(passesPrefilter({ ...good, chg1d: 4, pct_1w: 6 }).ok === false, 'rising now (no dip) → rejected');
ok(passesPrefilter({ ...good, chg1d: 2, pct_1w: -1 }).ok === true, 'up day but down week → still a dip');
ok(passesPrefilter({ pct_1y: null, market_cap: 2e9, chg1d: -3 }).ok === false, 'null 1Y → rejected (no silent pass)');

// ── huntPrefilter: filters + sorts by yearly strength, caps shortlist ──
const universe = [
  { symbol: 'W', pct_1y: 300, market_cap: 1e9, chg1d: -1 },   // pass, strongest
  { symbol: 'X', pct_1y: 50,  market_cap: 1e9, chg1d: -2 },   // pass
  { symbol: 'Y', pct_1y: 120, market_cap: 1e9, chg1d: 5, pct_1w: 8 }, // fail (not dipping)
  { symbol: 'Z', pct_1y: 90,  market_cap: 3e8, chg1d: -2 },   // fail (small cap)
];
const sl = huntPrefilter(universe);
ok(sl.length === 2, `shortlist keeps 2 valid (got ${sl.length})`);
ok(sl[0].symbol === 'W' && sl[1].symbol === 'X', 'sorted by yearly strength desc');
ok(huntPrefilter(Array.from({ length: 30 }, (_, i) => ({ symbol: 's' + i, pct_1y: 100 + i, market_cap: 1e9, chg1d: -1 }))).length === HUNTER.MAX_SHORTLIST, 'shortlist capped at MAX_SHORTLIST');

// ── score components (0..1) ──
ok(approx(trendComponent(300), 1), 'trend +300% → full');
ok(approx(trendComponent(150), 0.5), 'trend +150% → 0.5');
ok(trendComponent(null) === 0, 'trend null → 0');
ok(approx(dipComponent(40), 1), 'dip 40% → full');
ok(approx(dipComponent(20), 0.5), 'dip 20% → 0.5');
ok(dipComponent(0) === 0, 'dip 0 → 0');
ok(approx(volComponent(9), 1), 'vol at ideal 9% → full');
ok(volComponent(1) === 0, 'vol 1% (below band) → 0');
ok(volComponent(25) === 0, 'vol 25% (above band) → 0');
ok(volComponent(null) === 0, 'vol null → 0');

// ── convictionScore: weighted 0..100 ──
const perfect = convictionScore({ pct_1y: 300, dipPct: 40, atrPct: 9, hotSector: true });
ok(perfect === 100, `all-max → 100 (got ${perfect})`);
const none = convictionScore({ pct_1y: 0, dipPct: 0, atrPct: 100, hotSector: false });
ok(none === 0, `all-min → 0 (got ${none})`);
// strong year + good dip + hot sector, vol off-band
const partial = convictionScore({ pct_1y: 150, dipPct: 20, atrPct: 50, hotSector: true });
ok(partial === Math.round(0.5 * 40 + 0.5 * 35 + 15 + 0), `partial = 20+17.5+15+0 → 53 (got ${partial})`);
ok(convictionScore({ pct_1y: 100, dipPct: 30, atrPct: 9, hotSector: null }) ===
   convictionScore({ pct_1y: 100, dipPct: 30, atrPct: 9, hotSector: false }), 'unknown sector scores like no-bonus');

// ── isSafeEntry: red / brokeBelow excluded (safety overlaps Stage 1) ──
ok(isSafeEntry({ status: 'green', brokeBelow: false }) === true, 'green not broken → safe');
ok(isSafeEntry({ status: 'yellow', brokeBelow: false }) === true, 'yellow not broken → safe');
ok(isSafeEntry({ status: 'red', brokeBelow: false }) === false, 'red → not safe');
ok(isSafeEntry({ status: 'green', brokeBelow: true }) === false, 'broke channel → not safe');
ok(isSafeEntry(null) === false, 'no analysis → not safe');

// ── buildCandidate: merges quote + analysis, drops unsafe / out-of-band vol ──
const q = { symbol: 'KEEL', name: 'Keel', price: 5.78, market_cap: 3.49e9, pct_1y: 120, chg1d: -4 };
const aGreen = { status: 'green', brokeBelow: false, atrPct: 12, dip: { dipPct: 22 }, hotSector: true, sector: 'Technology' };
const cand = buildCandidate(q, aGreen, { hotSector: true, sector: 'Technology' });
ok(cand && cand.symbol === 'KEEL', 'safe green → candidate built');
ok(cand.displayPct === -22, `displayPct = -22 (dip from high, got ${cand?.displayPct})`);
ok(cand.dipSource === 'dip', 'dip from local high used when available');
ok(cand.score > 0, 'candidate has positive score');
ok(buildCandidate(q, { status: 'red', brokeBelow: false, atrPct: 12, dip: { dipPct: 22 } }) === null, 'red analysis → no candidate');
ok(buildCandidate(q, { status: 'green', brokeBelow: false, atrPct: 30, dip: { dipPct: 22 } }) === null, 'vol 30% out of band → no candidate');
// fallback to 1D when no candle dip
const candFallback = buildCandidate(q, { status: 'yellow', brokeBelow: false, atrPct: 8, dip: {} });
ok(candFallback.dipSource === 'day' && candFallback.displayPct === -4, 'falls back to 1D change when no dip-from-high');

// ── rankCandidates: sort by score desc, cap results ──
const ranked = rankCandidates([{ score: 10 }, { score: 90 }, null, { score: 50 }]);
ok(ranked.length === 3 && ranked[0].score === 90 && ranked[2].score === 10, 'ranked desc, nulls dropped');
ok(rankCandidates(Array.from({ length: 30 }, (_, i) => ({ score: i }))).length === HUNTER.MAX_RESULTS, 'results capped at MAX_RESULTS');

console.log(`\n+OFFIR Hunter: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
