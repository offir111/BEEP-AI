// Headless sanity check for src/engine/gridModel.js
// Run: node scripts/test-grid.mjs
import {
  buildCenteredGrid,
  computeRealizedApr,
  theoreticalApr,
  externalGridUsable,
} from '../src/engine/gridModel.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } };

console.log('— buildCenteredGrid centers on live price —');
const price = 65000;
const g = buildCenteredGrid(price, { levels: 12, bandPct: 0.06, investment: 1000 });
ok(g, 'returns a grid object');
ok(g.lower < price && g.upper > price, `price ${price} is inside [${g.lower.toFixed(0)}, ${g.upper.toFixed(0)}]`);
ok(g.grid.length === 12, '12 levels generated');
ok(g.grid.every(l => Number.isFinite(l.buy) && Number.isFinite(l.sell) && l.sell > l.buy), 'every level buy<sell, finite');
ok(g.grid.every(l => Number.isFinite(l.qty) && l.qty > 0), 'every level has positive qty (no NaN)');
ok(g.grid.every(l => Number.isFinite(l.profit) && l.profit > 0), 'every level has positive profit (no NaN)');
const filled = g.grid.filter(l => l.filled).length;
ok(filled > 0 && filled < 12, `partial fill makes sense (${filled}/12 below price)`);

console.log('— ATR-based band overrides percentage —');
const gAtr = buildCenteredGrid(price, { levels: 10, atr: 1500, investment: 2000 });
ok(gAtr.lower < price && gAtr.upper > price, 'ATR grid still brackets price');
ok(Math.abs((gAtr.upper - gAtr.lower) - Math.min(1500 * 4, price * 0.24)) < 1e-6, 'ATR span = min(4·ATR, 24% price)');

console.log('— guards —');
ok(buildCenteredGrid(0) === null, 'price 0 → null');
ok(buildCenteredGrid(-5) === null, 'negative price → null');
ok(buildCenteredGrid(NaN) === null, 'NaN price → null');

console.log('— realized APR —');
const day = 24 * 3600 * 1000;
const apr = computeRealizedApr({ realizedPnl: 50, investment: 1000, startMs: 0, nowMs: 30 * day });
ok(Math.abs(apr - (0.05 * (365 / 30) * 100)) < 1e-6, `30-day +5% → APR ≈ ${apr.toFixed(1)}%`);
ok(computeRealizedApr({ realizedPnl: 10, investment: 0, startMs: 0, nowMs: day }) === null, 'investment 0 → null');
ok(computeRealizedApr({ realizedPnl: 10, investment: 1000, startMs: 0, nowMs: 0 }) === null, 'no elapsed time → null');

console.log('— theoretical APR is bounded and labeled —');
const t = theoreticalApr(g, price);
ok(t != null && t > 0 && t <= 80, `theoretical APR in (0, 80]: ${t}%`);

console.log('— externalGridUsable —');
ok(externalGridUsable({ lower: 60000, upper: 70000 }, 65000) === true, 'price inside band → usable');
ok(externalGridUsable({ lower: 73160, upper: 81906 }, 65000) === false, 'stale band (73k-81k) vs 65k → NOT usable');
ok(externalGridUsable(null, 65000) === false, 'null grid → not usable');

console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
