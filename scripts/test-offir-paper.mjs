// scripts/test-offir-paper.mjs — headless tests for the STRONG BUY paper tracker.
import {
  PAPER_AMOUNT, MARKS, recordBuy, updateBook, liveReturn, rankByLiveReturn, summarize,
} from '../src/engine/offirPaper.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const approx = (a, b, e = 0.01) => a != null && Math.abs(a - b) <= e;
const DAY = 86400000;
const T0 = 1_700_000_000_000;   // fixed base ts (no Date.now — deterministic)

// ── recordBuy: $100 virtual, once per ticker ──
let book = recordBuy({ positions: {} }, { ticker: 'hut', price: 10, localHigh: 13, ts: T0 });
ok(book.positions.HUT, 'buy recorded (uppercased)');
ok(book.positions.HUT.entryPrice === 10 && approx(book.positions.HUT.qty, 10), '$100 at $10 → qty 10');
ok(book.positions.HUT.virtual === true, 'marked virtual');
book = recordBuy(book, { ticker: 'HUT', price: 99, localHigh: 1, ts: T0 + 5 });
ok(book.positions.HUT.entryPrice === 10, 'second buy of same ticker ignored (no double)');
ok(recordBuy(book, { ticker: 'X', price: 0, ts: T0 }).positions.X === undefined, 'invalid price → not bought');
ok(recordBuy(book, { ticker: 'Y', price: 5, ts: NaN }).positions.Y === undefined, 'invalid ts → not bought');

// ── updateBook: D/W/M captured as thresholds pass ──
let r = updateBook(book, { HUT: 10.2 }, T0 + 2 * 3600000);   // 2h later — no mark yet
ok(r.book.positions.HUT.marks.D == null, 'before D+1 → no D mark');
ok(r.changed === false, 'nothing captured → changed=false');

r = updateBook(book, { HUT: 10.2 }, T0 + DAY + 1000);        // just past 1 day, price 10.2
ok(approx(r.book.positions.HUT.marks.D, 2), `D captured = +2% (got ${r.book.positions.HUT.marks.D})`);
ok(r.changed === true, 'D captured → changed=true');
book = r.book;

// D already captured → not overwritten even if price moves
book = updateBook(book, { HUT: 11 }, T0 + DAY + 5000).book;
ok(approx(book.positions.HUT.marks.D, 2), 'D not overwritten once set');

// W after 7 days at 10.38 → +3.8%
book = updateBook(book, { HUT: 10.38 }, T0 + 7 * DAY + 1000).book;
ok(approx(book.positions.HUT.marks.W, 3.8), `W captured = +3.8% (got ${book.positions.HUT.marks.W?.toFixed(2)})`);
ok(book.positions.HUT.marks.M == null, 'M not captured before 30d');

// M after 30 days, price BELOW entry → negative return (loss shows red in UI)
book = updateBook(book, { HUT: 9.5 }, T0 + 30 * DAY + 1000).book;
ok(approx(book.positions.HUT.marks.M, -5), `M captured = -5% loss (got ${book.positions.HUT.marks.M})`);

// ── HIGH: captured when price recovers to localHigh (13) → (13-10)/10 = 30% ──
ok(book.positions.HUT.high == null, 'HIGH not captured until price reaches localHigh');
book = updateBook(book, { HUT: 13.5 }, T0 + 31 * DAY).book;
ok(approx(book.positions.HUT.high, 30), `HIGH = +30% at localHigh (got ${book.positions.HUT.high})`);

// ── liveReturn + ranking ──
let b2 = recordBuy({ positions: {} }, { ticker: 'AAA', price: 10, ts: T0 });
b2 = recordBuy(b2, { ticker: 'BBB', price: 20, ts: T0 });
b2 = recordBuy(b2, { ticker: 'CCC', price: 5, ts: T0 });
const prices = { AAA: 15, BBB: 22, CCC: 4 };   // +50%, +10%, -20%
ok(approx(liveReturn(b2.positions.AAA, 15), 50), 'liveReturn AAA = +50%');
const ranked = rankByLiveReturn(b2, prices);
ok(ranked[0].pos.ticker === 'AAA' && ranked[1].pos.ticker === 'BBB' && ranked[2].pos.ticker === 'CCC',
  'ranked by live return desc (AAA +50 → BBB +10 → CCC -20)');

// ── summarize ──
const s = summarize(b2, prices);
ok(s.count === 3 && s.graded === 3, 'summary counts 3 positions');
ok(approx(s.winPct, (2 / 3) * 100), `winPct = 66.7% (2 of 3 positive, got ${s.winPct?.toFixed(1)})`);

ok(PAPER_AMOUNT === 100 && MARKS.length === 3, 'constants: $100, 3 time marks');

console.log(`\n+OFFIR Paper: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
