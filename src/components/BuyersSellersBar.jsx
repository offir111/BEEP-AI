/**
 * BuyersSellersBar — a standalone, reusable green/red buyers-vs-sellers bar.
 *
 * It shows ONLY the order-book imbalance gauge (the colored bar + the two
 * percentages + a "קונים / מוכרים" label) — NOT the DOM price/size ladder.
 *
 * It is driven by the EXACT same live data source the BOOK MAP robot's DOM uses:
 * the same BinanceDepthFeed (Binance @depth@100ms WS + REST snapshot via the app
 * proxy) feeding the same OrderBookState, and the same top-N imbalance math as
 * DOMPanel (bidPct from topLevels). No synthetic data — feed down / stale book →
 * the bar shows a neutral 50/50 "אין נתון 🔴" state and stops advancing.
 *
 * Reuse, not duplication: HomePage and the BookmapRobot page are never mounted at
 * the same time (separate routes), so this owns a single ephemeral feed while the
 * home screen is visible and tears it down on unmount — there is never a second
 * concurrent WebSocket. The original DOM bar inside BOOK MAP is left untouched.
 *
 * Clicking the bar opens the BOOK MAP robot.
 */
import { useEffect, useRef, useState } from 'react';
import BinanceDepthFeed from '../robots/bookmap/data/BinanceDepthFeed';
import './BuyersSellersBar.css';

const LEVELS = 14;        // same top-N depth the DOM imbalance gauge uses
const SYMBOL = 'BTCUSDT'; // the main-screen BTC card symbol

export default function BuyersSellersBar({ navigate, symbol = SYMBOL }) {
  const feedRef = useRef(null);
  const [, setTick] = useState(0);

  // One live depth feed for the lifetime of the bar (mirrors DOMPanel's source).
  useEffect(() => {
    const feed = new BinanceDepthFeed(symbol);
    feedRef.current = feed;
    feed.start();
    const iv = setInterval(() => setTick(t => t + 1), 250);
    return () => {
      clearInterval(iv);
      feed.stop();
      feedRef.current = null;
    };
  }, [symbol]);

  const book = feedRef.current?.book;
  const ready = book && book.ready && !book.isStale();
  const { bids = [], asks = [] } = ready ? book.topLevels(LEVELS) : {};

  // Order-book imbalance — identical math to DOMPanel.
  const bidSum = bids.reduce((s, l) => s + l.qty, 0);
  const askSum = asks.reduce((s, l) => s + l.qty, 0);
  const tot = bidSum + askSum;
  const bidPct = tot > 0 ? (bidSum / tot) * 100 : 50;
  const askPct = 100 - bidPct;
  const lean = bidPct >= 55 ? 'buy' : bidPct <= 45 ? 'sell' : 'flat';

  return (
    <button
      type="button"
      className="bsb-wrap"
      onClick={() => navigate && navigate('bookmap')}
      title="קונים מול מוכרים — לחץ לפתיחת BOOK MAP"
      aria-label="פס קונים מול מוכרים — פתח את רובוט BOOK MAP"
    >
      <div className="bsb-head">
        <span className="bsb-title">קונים / מוכרים — עומק ספר</span>
        {!ready && <span className="bsb-nodata">אין נתון 🔴</span>}
      </div>

      {/* RTL: first child (green/bid) renders on the RIGHT, second (red/ask) on the LEFT */}
      <div className="bsb-bar">
        <div className="bsb-bid" style={{ width: `${bidPct}%` }} />
        <div className="bsb-ask" style={{ width: `${askPct}%` }} />
      </div>

      <div className="bsb-label">
        <span className="bsb-pct bsb-pct-bid">{bidPct.toFixed(0)}%</span>
        <span className="bsb-mid">
          <b className={lean === 'buy' ? 'bsb-strong-bid' : ''}>קונים</b>
          <span className="bsb-sep">/</span>
          <b className={lean === 'sell' ? 'bsb-strong-ask' : ''}>מוכרים</b>
        </span>
        <span className="bsb-pct bsb-pct-ask">{askPct.toFixed(0)}%</span>
      </div>
    </button>
  );
}
