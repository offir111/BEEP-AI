import OrderBookState from '../src/robots/bookmap/data/OrderBookState.js';
import HeatmapEngine from '../src/robots/bookmap/engine/HeatmapEngine.js';
import VolumeBubblesEngine from '../src/robots/bookmap/engine/VolumeBubblesEngine.js';
import IcebergStopsEngine from '../src/robots/bookmap/engine/IcebergStopsEngine.js';

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

const hm=new HeatmapEngine({rows:100,maxCols:10,halfSpanPct:0.5});
hm.setRangeFromMid(10);
ok(hm.priceToRow(14.999)===0,'top price → row 0');
ok(hm.priceToRow(5.001)>=98,'bottom price → high row');
hm.pushColumn(b);
ok(hm.columns.length===1 && hm.maxIntensity>0,'heatmap column pushed with intensity');

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
