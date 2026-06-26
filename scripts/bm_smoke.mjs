import OrderBookState from '../src/robots/bookmap/data/OrderBookState.js';
import HeatmapEngine from '../src/robots/bookmap/engine/HeatmapEngine.js';
import VolumeBubblesEngine from '../src/robots/bookmap/engine/VolumeBubblesEngine.js';
import IcebergStopsEngine from '../src/robots/bookmap/engine/IcebergStopsEngine.js';
import CandleEngine from '../src/robots/bookmap/engine/CandleEngine.js';
import VolumeProfileEngine from '../src/robots/bookmap/engine/VolumeProfileEngine.js';

let pass=0, fail=0;
const ok=(c,m)=>{ c?pass++:fail++; console.log((c?'✓':'✗ FAIL')+' '+m); };

const b=new OrderBookState();
b.applySnapshot({lastUpdateId:100, bids:[['10.0','2'],['9.0','3']], asks:[['11.0','1'],['12.0','5']]});
ok(b.bestBid()===10 && b.bestAsk()===11, 'snapshot best bid/ask');
ok(b.mid()===10.5, 'mid');
ok(b.applyDiff({U:90,u:100,b:[['10.0','9']],a:[]})===true && b.bids.get('10.0')===2,'stale diff dropped');
ok(b.applyDiff({U:101,u:102,b:[['10.0','0'],['8.5','4']],a:[['11.0','7']]})===true,'contiguous diff applied');
ok(b.bids.get('10.0')===undefined,'qty0 removed level');
ok(b.bids.get('8.5')===4,'new bid level');
ok(b.asks.get('11.0')===7,'ask updated');
ok(b.bestBid()===9,'best bid after removal');
ok(b.applyDiff({U:200,u:205,b:[],a:[]})===false,'gap detected → resync');

const hm=new HeatmapEngine({rows:100,maxCols:10,windowMs:600000});
hm.recordSample(10, 1000);
ok(hm.hasRange() && hm.pMin<10 && hm.pMax>10,'auto-range brackets the price');
// Range eases toward recent [lo,hi]; converge by feeding the extremes repeatedly.
let t0=2000; for(let i=0;i<80;i++){ hm.recordSample(i%2?10.10:9.90, t0+=10); }
ok(hm.pMin<9.90 && hm.pMax>10.10,'auto-range converges to bracket recent hi/lo');
ok(hm.priceToRow(hm.pMax-1e-9)===0,'top price → row 0');
ok(hm.priceToRow(hm.pMin+1e-9)>=98,'bottom price → high row');
// Realistic tight book whose levels sit inside the range.
const hb=new OrderBookState();
hb.applySnapshot({lastUpdateId:1, bids:[['9.95','2'],['9.90','3']], asks:[['10.05','1'],['10.10','4']]});
hm.pushColumn(hb);
ok(hm.columns.length===1 && hm.maxIntensity>0,'heatmap column pushed with intensity');
const grid=hm.buildGrid();
ok(grid.length===10*100,'buildGrid returns maxCols*rows');
ok(grid.some(v=>v>0),'grid has liquidity from the book');

const vb=new VolumeBubblesEngine();
vb.addTrade({price:10,qty:5,buyerMaker:false,ts:1000});
vb.addTrade({price:10,qty:50,buyerMaker:true,ts:5000});
ok(vb.bubbles.length===2,'two distinct bubbles');
ok(vb.bubbles[0].buy===true && vb.bubbles[1].buy===false,'buy/sell colour mapping');
ok(vb.maxQty===50,'maxQty tracks largest');
vb.prune(20000); ok(vb.bubbles.length===0,'old bubbles pruned');

const ic=new IcebergStopsEngine({sweepLevels:4,sweepWindowMs:1200});
let ts=0; for(let i=0;i<8;i++){ ic.onTrade({price:100+i,qty:1,buyerMaker:false,ts:ts+=50}); }
ok(ic.events.some(e=>e.type==='stop'&&e.side==='up'),'stop-run sweep detected from real burst');

// Candles from aggTrades
const ce=new CandleEngine({tf:1000});
ce.addTrade({price:10,qty:1,buyerMaker:false,ts:1000});
ce.addTrade({price:12,qty:1,buyerMaker:true,ts:1500});  // same 1s bucket
ce.addTrade({price:9, qty:1,buyerMaker:false,ts:1900});
ce.addTrade({price:11,qty:1,buyerMaker:false,ts:2200});  // next bucket
ok(ce.candles.length===2,'two candle buckets');
ok(ce.candles[0].o===10 && ce.candles[0].h===12 && ce.candles[0].l===9 && ce.candles[0].c===9,'candle OHLC correct');

// Volume profile binning buy/sell
const vp=new VolumeProfileEngine();
vp.addTrade({price:10,qty:3,buyerMaker:false}); // buy
vp.addTrade({price:10,qty:2,buyerMaker:true});  // sell
const prof=vp.profile(9,11,10);
ok(prof.max>0 && prof.buy.some(v=>v>0) && prof.sell.some(v=>v>0),'volume profile splits buy/sell by price');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
