/**
 * SymbolPicker — real USDT-pair selector from Binance exchangeInfo, with search.
 * Selecting a symbol tears down every socket and reconnects fresh (handled by
 * the parent via onChange).
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchUsdtSymbols, popularFirst, POPULAR } from '../data/SymbolList';

export default function SymbolPicker({ symbol, onChange }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(POPULAR);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchUsdtSymbols()
      .then(syms => { if (!cancelled && syms.length) setAll(popularFirst(syms)); })
      .catch(() => { /* keep POPULAR fallback */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const base = needle ? all.filter(s => s.includes(needle)) : all;
    return base.slice(0, 200);
  }, [q, all]);

  return (
    <div className="bm-sym" ref={ref}>
      <button className="bm-sym-btn" onClick={() => setOpen(o => !o)}>
        {symbol} <span className="bm-sym-caret">▾</span>
      </button>
      {open && (
        <div className="bm-sym-pop">
          <input
            className="bm-sym-search"
            autoFocus
            placeholder="חיפוש מטבע…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="bm-sym-list">
            {filtered.map(s => (
              <button
                key={s}
                className={`bm-sym-item ${s === symbol ? 'bm-sym-item--on' : ''}`}
                onClick={() => { onChange(s); setOpen(false); setQ(''); }}
              >{s}</button>
            ))}
            {filtered.length === 0 && <div className="bm-sym-empty">לא נמצא</div>}
          </div>
        </div>
      )}
    </div>
  );
}
