/**
 * DOMPanel — live Depth of Market ladder. Shows ALL near-touch levels (top-N)
 * from the real OrderBookState: bid (green) below, ask (red) above, each with a
 * size histogram. Includes One-Click Trading buttons — clearly DEMO 🟡 (no real
 * order is ever sent).
 */
import { useState, useEffect } from 'react';

function fmtQty(q) {
  if (q == null) return '';
  if (q >= 1000) return (q / 1000).toFixed(1) + 'K';
  if (q >= 1) return q.toFixed(2);
  return q.toFixed(4);
}
function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

export default function DOMPanel({ getBook, levels = 14, demo = false, onDemoOrder }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(iv);
  }, []);

  const book = getBook && getBook();
  const ready = book && book.ready && !book.isStale();
  const { bids = [], asks = [] } = ready ? book.topLevels(levels) : {};
  const maxQty = Math.max(1, ...bids.map(l => l.qty), ...asks.map(l => l.qty));
  const asksDesc = [...asks].reverse();   // show highest ask on top

  return (
    <div className="bm-dom">
      <div className="bm-dom-head">
        <span>DOM — עומק ספר</span>
        {!ready && <span className="bm-dom-nodata">אין נתון 🔴</span>}
      </div>

      <div className="bm-dom-ladder">
        {asksDesc.map((l, i) => (
          <div className="bm-dom-row bm-dom-ask" key={'a' + i}>
            <div className="bm-dom-bar bm-dom-bar-ask" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span className="bm-dom-qty">{fmtQty(l.qty)}</span>
            <span className="bm-dom-price">{fmtPrice(l.price)}</span>
          </div>
        ))}

        <div className="bm-dom-mid">
          {ready && book.mid() != null ? `↔ ${fmtPrice(book.mid())}` : '—'}
        </div>

        {bids.map((l, i) => (
          <div className="bm-dom-row bm-dom-bid" key={'b' + i}>
            <div className="bm-dom-bar bm-dom-bar-bid" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span className="bm-dom-qty">{fmtQty(l.qty)}</span>
            <span className="bm-dom-price">{fmtPrice(l.price)}</span>
          </div>
        ))}
      </div>

      <div className="bm-dom-trade">
        <span className="bm-demo-tag">DEMO 🟡</span>
        <button className="bm-buy" onClick={() => onDemoOrder && onDemoOrder('buy', book?.bestAsk())}>קנה</button>
        <button className="bm-sell" onClick={() => onDemoOrder && onDemoOrder('sell', book?.bestBid())}>מכור</button>
      </div>
    </div>
  );
}
