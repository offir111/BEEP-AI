import { useEffect } from 'react';
import { useQuote } from '../context/LiveQuoteContext';
import LiveQuoteContext from '../context/LiveQuoteContext';
import { useContext } from 'react';
import './LivePrice.css';

// ── Price formatter (mirrors utils/format.js logic) ──────────────────────────

function formatPrice(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  const num = parseFloat(n);
  if (num >= 1000)  return num.toLocaleString('en', { maximumFractionDigits: 0 });
  if (num >= 1)     return num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 0.01)  return num.toFixed(4);
  return num.toFixed(6);
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * <LivePrice symbol="BTC" />
 * <LivePrice symbol="BTC" showChange />
 * <LivePrice symbol="BTC" showChange showHL />
 * <LivePrice symbol="AAPL" prefix="$" />
 *
 * Props:
 *   symbol     {string}  required — e.g. "BTC", "AAPL", "GOLD"
 *   showChange {bool}    show change% with colored ▲/▼
 *   showHL     {bool}    show high / low (requires showChange)
 *   prefix     {string}  e.g. "$" — prepended to the price
 *   className  {string}  extra CSS class on root element
 */
export default function LivePrice({
  symbol,
  showChange = false,
  showHL     = false,
  prefix     = '',
  className  = '',
}) {
  const ctx = useContext(LiveQuoteContext);
  const { price, change, high, low, flash } = useQuote(symbol);

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    if (!symbol || !ctx) return;
    ctx.subscribe([symbol]);
    return () => ctx.unsubscribe([symbol]);
  }, [symbol, ctx]);

  const formattedPrice = formatPrice(price);

  const priceClass = [
    'lp-price',
    flash === 'up'   ? 'lp-flash-up'   : '',
    flash === 'down' ? 'lp-flash-down' : '',
  ].filter(Boolean).join(' ');

  const changePositive = change !== null && change >= 0;
  const changeClass    = changePositive ? 'lp-change lp-change--up' : 'lp-change lp-change--down';
  const changeArrow    = changePositive ? '▲' : '▼';
  const changeFormatted =
    change !== null ? `${changeArrow} ${Math.abs(change).toFixed(2)}%` : null;

  return (
    <span className={`lp-root ${className}`.trim()}>
      <span className={priceClass}>
        {prefix && <span className="lp-prefix">{prefix}</span>}
        {formattedPrice !== null ? formattedPrice : <span className="lp-loading">…</span>}
      </span>

      {showChange && changeFormatted !== null && (
        <span className={changeClass}>{changeFormatted}</span>
      )}

      {showChange && showHL && high !== null && low !== null && (
        <span className="lp-hl">
          <span className="lp-high">H {formatPrice(high)}</span>
          <span className="lp-sep">/</span>
          <span className="lp-low">L {formatPrice(low)}</span>
        </span>
      )}
    </span>
  );
}
