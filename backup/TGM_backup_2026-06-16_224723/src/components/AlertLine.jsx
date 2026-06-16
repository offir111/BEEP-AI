import { useRef } from 'react';
import './AlertLine.css';

// ── Price-to-Y mapping (mirrors TradingView chart area) ───────
const TV_TOP  = 0.09; // top of price area (after toolbar)
const TV_BOT  = 0.82; // bottom of price area (before volume/time)
const TV_SPAN = TV_BOT - TV_TOP;

function priceToYPct(price, rangeLow, rangeSpan) {
  const raw = TV_TOP + (1 - (price - rangeLow) / rangeSpan) * TV_SPAN;
  return Math.min(Math.max(raw, TV_TOP), TV_BOT) * 100; // clamp + %
}

export default function AlertLine({ alert, containerH, currentPrice, chartRange, onPriceChange, onRemove }) {
  const lineRef   = useRef(null);
  const dragState = useRef(null);

  // Use real kline high/low if available, else fallback to ±40% estimate
  const rangeHigh = chartRange?.high ?? currentPrice * 1.40;
  const rangeLow  = chartRange?.low  ?? currentPrice * 0.60;
  const rangeSpan = rangeHigh - rangeLow;

  const yPct = priceToYPct(alert.target, rangeLow, rangeSpan);
  const isAbove = alert.direction === 'above';
  const color   = isAbove ? '#D4AF37' : '#ef4444';
  const label   = isAbove ? '↑' : '↓';

  // ── Drag with pointer capture ──────────────────────────────
  const onPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = lineRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragState.current = {
      startY:     e.clientY,
      startPrice: alert.target,
      pxPerPrice: (containerH * TV_SPAN) / rangeSpan,
    };
  };

  const onPointerMove = (e) => {
    if (!dragState.current) return;
    const { startY, pxPerPrice } = dragState.current;
    const dy = e.clientY - startY;
    if (lineRef.current) {
      lineRef.current.style.transform = `translateY(${dy}px)`;
    }
  };

  const onPointerUp = (e) => {
    if (!dragState.current) return;
    const { startY, startPrice, pxPerPrice } = dragState.current;
    const dy = e.clientY - startY;
    const newPrice = Math.max(0.01, startPrice - dy / pxPerPrice);
    dragState.current = null;
    if (lineRef.current) lineRef.current.style.transform = '';
    onPriceChange(alert.id, parseFloat(newPrice.toFixed(newPrice > 100 ? 2 : 4)));
  };

  const onPointerCancel = () => {
    dragState.current = null;
    if (lineRef.current) lineRef.current.style.transform = '';
  };

  return (
    <div
      ref={lineRef}
      className="alert-line"
      style={{ top: `${yPct}%`, '--lc': color }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* The line itself */}
      <div className="alert-line__bar" />

      {/* Left label */}
      <div className="alert-line__label-left">
        <span className="alert-line__dir">{label}</span>
        <span className="alert-line__price">${alert.target.toLocaleString()}</span>
        {alert.note && <span className="alert-line__note">{alert.note}</span>}
      </div>

      {/* Drag handle */}
      <div className="alert-line__handle" title="גרור לשינוי מחיר" aria-label="גרור לשינוי מחיר">≡</div>

      {/* Delete */}
      <button
        className="alert-line__del"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onRemove(alert.id)}
        title="מחק התראה"
      >✕</button>
    </div>
  );
}
