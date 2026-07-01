// scripts/test-offir-conviction.mjs — headless tests for the Stage-3 conviction engine.
import {
  CONVICTION, detectCatalystHeadline, convictionBadges, recommend, RECO,
} from '../src/engine/offirConviction.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── detectCatalystHeadline: conservative (verb + giant, not vague) ──
const hStrong = [{ title: 'Google acquires 5% stake in Cipher Mining', url: 'u', date: 'd' }];
ok(detectCatalystHeadline(hStrong).strong === true, 'verb(acquires)+giant(Google) → strong');
ok(detectCatalystHeadline([{ title: 'NVIDIA partnership with Hut 8 for AI compute' }]).strong === true, 'partnership + NVIDIA → strong');
ok(detectCatalystHeadline([{ title: 'Google is considering a stake in Cipher' }]).strong === false, 'vague (considering) → NOT strong');
ok(detectCatalystHeadline([{ title: 'Company reportedly in talks to acquire rival' }]).strong === false, 'vague (in talks/reportedly) → NOT strong');
ok(detectCatalystHeadline([{ title: 'Firm acquires small competitor' }]).strong === false, 'verb but no giant → NOT strong');
ok(detectCatalystHeadline([{ title: 'Bitcoin drops 10%' }]).strong === false, 'no verb/giant → NOT strong');
ok(detectCatalystHeadline([{ title: 'Latest news here' }]).latest.title === 'Latest news here', 'latest headline returned for display');
ok(detectCatalystHeadline([]).strong === false && detectCatalystHeadline([]).latest === null, 'empty → not strong, no latest');
// picks the strong one even if not first
const mixed = [{ title: 'Bitcoin dips' }, { title: 'Microsoft invests in the company' }];
ok(detectCatalystHeadline(mixed).strong === true && detectCatalystHeadline(mixed).giant === 'microsoft', 'scans all headlines for the strong one');

// ── convictionBadges: green only on real data ──
const q = { relVolume: 3.1, analystRecom: 1.2, instOwn: 61.5, targetPrice: 32, headlines: [{ title: 'x' }] };
const b = convictionBadges(q, true);
ok(b.volume.on === true && b.volume.value === 3.1, 'relVol 3.1 ≥ 2 → volume badge on');
ok(b.analyst.on === true, 'Recom 1.2 ≤ 2 → analyst badge on');
ok(b.institutional.on === true, 'InstOwn 61.5% ≥ 50 → institutional badge on');
ok(b.catalyst.on === true, 'catalystStrong → catalyst badge on');
const b2 = convictionBadges({ relVolume: 0.6, analystRecom: 3.5, instOwn: 20 }, false);
ok(b2.volume.on === false && b2.analyst.on === false && b2.institutional.on === false && b2.catalyst.on === false, 'weak data → all badges off');
ok(convictionBadges({}).analyst.known === false, 'missing analyst → known=false (not a false-pass)');

// ── recommend: decision table + safety override ──
const badgesStrong = convictionBadges(q, true);
const badgesNone   = convictionBadges({}, false);

// safety override: broken technical → caution even with strong catalyst
ok(recommend({ analysis: { status: 'red', brokeBelow: true }, badges: badgesStrong, catalystStrong: true }).level === 'caution',
  'broken technical + strong catalyst → CAUTION (safety overrides)');
ok(recommend({ analysis: { status: 'green', brokeBelow: true }, badges: badgesStrong, catalystStrong: true }).level === 'caution',
  'brokeBelow → CAUTION even if status green');

// STRONG BUY: entry + strong backing
const sb = recommend({ analysis: { status: 'green', brokeBelow: false }, badges: badgesStrong, catalystStrong: true });
ok(sb.level === 'strong_buy' && sb.dcaOk === true && sb.conviction === 'גבוהה', 'entry + strong catalyst → STRONG BUY, DCA ok, high conviction');
// strong backing via analyst+inst+volume (no catalyst)
const sb2 = recommend({ analysis: { status: 'green', brokeBelow: false }, badges: convictionBadges(q, false), catalystStrong: false });
ok(sb2.level === 'strong_buy', 'entry + analyst+inst+volume → STRONG BUY');

// BUY: entry + partial backing
const partialBadges = convictionBadges({ analystRecom: 1.5 }, false); // analyst only
ok(recommend({ analysis: { status: 'green', brokeBelow: false }, badges: partialBadges, catalystStrong: false }).level === 'buy',
  'entry + partial backing → BUY');
// entry + no backing → MIX (not a strong category by default)
ok(recommend({ analysis: { status: 'green', brokeBelow: false }, badges: badgesNone, catalystStrong: false }).level === 'mix',
  'entry + zero backing → MIX (default, not arbitrary strong)');

// WAIT: uptrend but not at entry, with backing
ok(recommend({ analysis: { status: 'yellow', brokeBelow: false }, badges: partialBadges, catalystStrong: false }).level === 'wait',
  'yellow + backing → המתן לאישור טכני');
// yellow + no backing → MIX
ok(recommend({ analysis: { status: 'yellow', brokeBelow: false }, badges: badgesNone, catalystStrong: false }).level === 'mix',
  'yellow + no backing → MIX');

ok(recommend({ analysis: null }).level === 'mix', 'no analysis → MIX default');
ok(RECO.STRONG_BUY.dcaOk === true && RECO.CAUTION.dcaOk === false, 'only STRONG BUY approves DCA');

console.log(`\n+OFFIR Conviction: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
