/**
 * IndicatorMenu — the "Heatmap" dropdown in the top bar. Replaces the old
 * indicator-toggle row: each layer is a checkbox toggle (✓ when on).
 */
import { useState, useEffect, useRef } from 'react';

const ITEMS = [
  { key: 'profile',  label: '📊 Volume Profile' },
  { key: 'icebergs', label: '🧊 Iceberg/Stop' },
  { key: 'bbo',      label: '📏 BBO' },
  { key: 'bubbles',  label: '🫧 בועות' },
  { key: 'candles',  label: '🕯️ נרות' },
  { key: 'heatmap',  label: '🌡️ Heatmap' },
];

export default function IndicatorMenu({ toggles, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const onCount = ITEMS.filter(i => toggles[i.key]).length;

  return (
    <div className="bm-menu" ref={ref}>
      <button className={`bm-menu-btn ${open ? 'on' : ''}`} onClick={() => setOpen(o => !o)}>
        🌡️ Heatmap <span className="bm-menu-badge">{onCount}</span> <span className="bm-caret">▾</span>
      </button>
      {open && (
        <div className="bm-menu-pop">
          <div className="bm-menu-head">אינדיקטורים</div>
          {ITEMS.map(it => (
            <button key={it.key}
              className={`bm-menu-item bm-menu-toggle ${toggles[it.key] ? 'on' : ''}`}
              onClick={() => onToggle(it.key)}
              aria-pressed={!!toggles[it.key]}>
              <span className="bm-menu-check">{toggles[it.key] ? '✓' : ''}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
