/**
 * QuickAlert.jsx — 1:1 clone of S.T.B alerts dialog (dl() component)
 * Color-adapted to beep-ai palette. All dimensions, layout, features,
 * logic and animations are identical to source.
 *
 * Source: C:\Users\Admin\Downloads\S.T.B\live\index-BrRuZL4L-v104.js
 * READ ONLY (no source modifications)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAlerts, fetchLivePrice } from '../context/AlertsContext';
import './QuickAlert.css';

/* ── Step-size logic (1:1 from S.T.B) ─────────────────────── */
function getStep(val) {
  if (val < 1)    return { step: 0.001, dec: 4 };
  if (val < 100)  return { step: 0.01,  dec: 2 };
  if (val < 1000) return { step: 1,     dec: 2 };
  return             { step: 10,    dec: 2 };
}

function fmtP(p) {
  if (!p && p !== 0) return '';
  return p.toLocaleString('en', { maximumFractionDigits: p > 100 ? 2 : 4 });
}

export default function QuickAlert({
  symbol:       initSymbol    = 'BTC',
  currentPrice: initPrice     = null,
  onClose,
  stockGainers  = [],
  cryptoGainers = [],
  embedded      = false,       // true → renders inline in AlertsPage (no overlay)
}) {
  const {
    alerts, addAlert, editAlert, removeAlert,
    fixedSlots, setFixedSlots,
    customSlots, setCustomSlots,
    clearSymbol, clearAll,
  } = useAlerts();

  /* ── Symbol / live price ─────────────────────────────────── */
  const [symbol,       setSymbol]       = useState(initSymbol);
  const [livePrice,    setLivePrice]    = useState(initPrice);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const livePriceRef = useRef(initPrice);
  useEffect(() => { livePriceRef.current = livePrice; }, [livePrice]);

  /* ── Form state ──────────────────────────────────────────── */
  const [inputVal,  setInputVal]  = useState('');
  const [direction, setDirection] = useState('above');
  const [duration,  setDuration]  = useState('year');   // 'eod' | 'year'
  const [editId,    setEditId]    = useState(null);

  /* ── % row ───────────────────────────────────────────────── */
  const [pctDown, setPctDown] = useState('3');
  const [pctUp,   setPctUp]   = useState('5');

  /* ── Slots edit mode ─────────────────────────────────────── */
  const [slotsEditMode, setSlotsEditMode] = useState(false);
  const [editingSlot,   setEditingSlot]   = useState(null); // {type:'fixed'|'custom', idx}
  const [slotInput,     setSlotInput]     = useState('');

  /* ── Confirm overlays ────────────────────────────────────── */
  const [confirmClearSym, setConfirmClearSym] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  /* ── Hold-repeat refs ────────────────────────────────────── */
  const holdRef = useRef({ timer: null, interval: null });

  /* ── Fetch price when symbol changes ─────────────────────── */
  useEffect(() => {
    setLoadingPrice(true);
    setLivePrice(null);
    fetchLivePrice(symbol)
      .then(p  => { if (p) setLivePrice(p); })
      .catch(() => {})
      .finally(() => setLoadingPrice(false));
  }, [symbol]);

  /* sync prop price */
  useEffect(() => { if (initPrice) setLivePrice(initPrice); }, [initPrice]);

  /* ── Step (hold-repeat, 380ms delay → 70ms interval) ────── */
  const doStep = useCallback((dir) => {
    setInputVal(v => {
      const val  = parseFloat(v) || livePriceRef.current || 0;
      const { step, dec } = getStep(val);
      const next = dir === 'up' ? val + step : Math.max(0, val - step);
      return next.toFixed(dec);
    });
  }, []);

  const stepStart = (dir) => {
    doStep(dir);
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.interval = setInterval(() => doStep(dir), 70);
    }, 380);
  };
  const stepEnd = () => {
    clearTimeout(holdRef.current.timer);
    clearInterval(holdRef.current.interval);
  };

  /* ── Auto-direction on type ──────────────────────────────── */
  const handleInputChange = (val) => {
    setInputVal(val);
    const t = parseFloat(val);
    if (livePrice && t > 0) setDirection(t >= livePrice ? 'above' : 'below');
  };

  /* ── Fill current price ──────────────────────────────────── */
  const fillCurrentPrice = () => {
    if (!livePrice) return;
    const { dec } = getStep(livePrice);
    setInputVal(livePrice.toFixed(dec));
    setDirection('above');
  };

  /* ── % row setters ───────────────────────────────────────── */
  const setPctTarget = (pct, dir) => {
    if (!livePrice || !(pct > 0)) return;
    const factor = dir === 'up' ? 1 + pct / 100 : 1 - pct / 100;
    const target = livePrice * factor;
    const { dec } = getStep(target);
    setInputVal(target.toFixed(dec));
    setDirection(dir === 'up' ? 'above' : 'below');
  };

  /* ── Add / update alert ──────────────────────────────────── */
  const handleAdd = () => {
    const t = parseFloat(inputVal);
    if (!t || t <= 0) return;
    if (editId) {
      editAlert(editId, { target: t, direction, duration });
      setEditId(null);
    } else {
      addAlert({ symbol: symbol.toUpperCase(), direction, target: t, duration, note: '' });
    }
    setInputVal('');
  };

  /* ── START: add + close ──────────────────────────────────── */
  const handleStart = () => {
    const t = parseFloat(inputVal);
    if (!t || t <= 0) return;
    if (editId) {
      editAlert(editId, { target: t, direction, duration });
      setEditId(null);
    } else {
      addAlert({ symbol: symbol.toUpperCase(), direction, target: t, duration, note: '' });
    }
    setInputVal('');
    onClose?.();
  };

  /* ── Enter / cancel edit ─────────────────────────────────── */
  const enterEdit = (a) => {
    setEditId(a.id);
    setInputVal(String(a.target));
    setDirection(a.direction);
    setDuration(a.duration || 'year');
  };
  const cancelEdit = () => { setEditId(null); setInputVal(''); };

  /* ── Select symbol ───────────────────────────────────────── */
  const selectSymbol = (sym) => {
    setSymbol(sym.toUpperCase());
    setEditId(null);
    setInputVal('');
  };

  /* ── Save edited slot ────────────────────────────────────── */
  const saveSlot = (type, idx, val) => {
    const v = val.trim().toUpperCase();
    if (type === 'fixed') {
      const next = [...fixedSlots];
      next[idx] = v || fixedSlots[idx];
      setFixedSlots(next);
    } else {
      const next = [...customSlots];
      next[idx] = v;
      setCustomSlots(next);
    }
    setEditingSlot(null);
  };

  /* ── Derived values ──────────────────────────────────────── */
  const symAlerts    = alerts.filter(a => a.symbol === symbol.toUpperCase());
  const activeAlerts = symAlerts.filter(a => !a.triggered);
  const typedT       = parseFloat(inputVal);
  const isBelow      = livePrice && typedT > 0 ? typedT < livePrice : direction === 'below';

  /* ── Gainers tabs ────────────────────────────────────────── */
  const gainerTabs = [
    ...cryptoGainers.slice(0, 3).map(g => ({
      sym: g.symbol || g.sym, pct: +(g.changePercent ?? g.pct ?? 0), type: 'crypto',
    })),
    ...stockGainers.slice(0, 3).map(g => ({
      sym: g.symbol || g.sym, pct: +(g.changePercent ?? g.pct ?? 0), type: 'stock',
    })),
  ].filter(g => g.sym);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */

  // Shared dialog content (used in both modal and embedded modes)
  const dialog = (
    <div
      className={`sa-alert-dialog${embedded ? ' sa-alert-dialog--embedded' : ''}`}
      onClick={embedded ? undefined : e => e.stopPropagation()}
    >

        {/* ═══ TOP ═══════════════════════════════════════════ */}
        <div className="sa-alert-top">

          {/* Header */}
          <div className="sa-alert-hdr">
            <div className="sa-alert-hdr-sym">
              <span className="sa-alert-sym-big">{symbol}</span>
              <span className="sa-alert-hdr-sub">התראות מחיר</span>
            </div>
            <div className="sa-alert-hdr-actions">
              <button className="sa-alert-close" onClick={onClose} aria-label="סגור">✕</button>
            </div>
          </div>

          {/* Gainers quick-tabs (conditional) */}
          {gainerTabs.length > 0 && (
            <div className="sa-alert-quick-tabs">
              {gainerTabs.map((g, i) => (
                <button key={i}
                  className={`sa-alert-quick-tab${symbol === g.sym ? ' --active' : ''}${g.type === 'crypto' ? ' --crypto' : ''}`}
                  onClick={() => selectSymbol(g.sym)}>
                  <span className="sa-alert-quick-sym">{g.sym}</span>
                  <span className={`sa-alert-quick-pct ${g.pct >= 0 ? '--up' : '--dn'}`}>
                    {g.pct >= 0 ? '+' : ''}{g.pct.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Fixed slots */}
          <div className={`sa-alert-shortcuts${slotsEditMode ? ' --slots-edit' : ''}`}>
            {fixedSlots.map((s, i) => {
              const isEditing = slotsEditMode && editingSlot?.type === 'fixed' && editingSlot.idx === i;
              return (
                <div key={i} className="sa-alert-slot-wrap">
                  {isEditing ? (
                    <div className="sa-alert-slot-edit">
                      <input className="sa-alert-slot-input"
                        value={slotInput} autoFocus
                        onChange={e => setSlotInput(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  saveSlot('fixed', i, slotInput);
                          if (e.key === 'Escape') setEditingSlot(null);
                        }} />
                      <button className="sa-alert-slot-save"
                        onClick={() => saveSlot('fixed', i, slotInput)}>✓</button>
                    </div>
                  ) : (
                    <button
                      className={`sa-alert-shortcut-btn${symbol === s ? ' --active' : ''}`}
                      onClick={() => slotsEditMode
                        ? (setEditingSlot({ type: 'fixed', idx: i }), setSlotInput(s))
                        : selectSymbol(s)}>
                      {s}
                    </button>
                  )}
                </div>
              );
            })}
            <button
              className={`sa-alert-slots-edit-btn${slotsEditMode ? ' --active' : ''}`}
              onClick={() => { setSlotsEditMode(m => !m); setEditingSlot(null); }}>
              {slotsEditMode ? '✓' : '✏'}
            </button>
          </div>

          {/* Custom slots */}
          <div className={`sa-alert-shortcuts sa-alert-custom-slots${slotsEditMode ? ' --slots-edit' : ''}`}>
            {customSlots.map((s, i) => {
              const isEmpty   = !s;
              const isEditing = slotsEditMode && editingSlot?.type === 'custom' && editingSlot.idx === i;
              return (
                <div key={i} className="sa-alert-slot-wrap">
                  {isEditing ? (
                    <div className="sa-alert-slot-edit">
                      <input className="sa-alert-slot-input"
                        value={slotInput} autoFocus
                        onChange={e => setSlotInput(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  saveSlot('custom', i, slotInput);
                          if (e.key === 'Escape') setEditingSlot(null);
                        }} />
                      <button className="sa-alert-slot-save"
                        onClick={() => saveSlot('custom', i, slotInput)}>✓</button>
                    </div>
                  ) : (
                    <button
                      className={`sa-alert-shortcut-btn sa-alert-custom-slot-btn${isEmpty ? ' --empty' : ''}${!isEmpty && symbol === s ? ' --active' : ''}`}
                      onClick={() => {
                        if (isEmpty || slotsEditMode) {
                          setEditingSlot({ type: 'custom', idx: i });
                          setSlotInput(s || '');
                        } else {
                          selectSymbol(s);
                        }
                      }}>
                      {isEmpty ? '+' : s}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Control panel */}
          <div className="sa-alert-ctrl-panel">

            {/* Duration corner */}
            <div className="sa-alert-dur-corner">
              <div className="sa-alert-dur-group">
                {[['eod', 'D'], ['year', 'Y']].map(([d, lbl]) => (
                  <button key={d}
                    className={`sa-alert-dur-btn${duration === d ? ' --active' : ''}`}
                    onClick={() => setDuration(d)}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Current price — full clickable button */}
            <button className="sa-alert-current-btn"
              onClick={fillCurrentPrice}
              disabled={!livePrice}>
              {loadingPrice ? (
                <span className="sa-alert-current-loading">טוען…</span>
              ) : livePrice ? (
                <>
                  <span className="sa-alert-current-label">מחיר נוכחי ↙ לחץ למלא</span>
                  <span className="sa-alert-current-price">{fmtP(livePrice)}</span>
                  <span className="sa-alert-current-sym-tag">{symbol}</span>
                </>
              ) : (
                <>
                  <span className="sa-alert-current-loading">—</span>
                  <span className="sa-alert-current-sym-tag">{symbol}</span>
                </>
              )}
            </button>

            {/* % offset row */}
            <div className="sa-alert-pct-row">
              <div className="sa-alert-pct-col">
                <span className="sa-alert-pct-lbl sa-alert-pct-lbl--dn">▼ -%</span>
                <input className="sa-alert-pct-input" type="number" min="0"
                  value={pctDown} onChange={e => setPctDown(e.target.value)} />
                {livePrice && parseFloat(pctDown) > 0 && (
                  <span className="sa-alert-pct-preview sa-alert-pct-preview--dn">
                    {fmtP(livePrice * (1 - parseFloat(pctDown) / 100))}
                  </span>
                )}
              </div>
              <button className="sa-alert-pct-btn"
                onClick={() => setPctTarget(parseFloat(pctDown), 'down')}>SL</button>
              <button className="sa-alert-pct-btn"
                onClick={() => setPctTarget(parseFloat(pctUp), 'up')}>TP</button>
              <div className="sa-alert-pct-col">
                <span className="sa-alert-pct-lbl sa-alert-pct-lbl--up">▲ +%</span>
                <input className="sa-alert-pct-input" type="number" min="0"
                  value={pctUp} onChange={e => setPctUp(e.target.value)} />
                {livePrice && parseFloat(pctUp) > 0 && (
                  <span className="sa-alert-pct-preview sa-alert-pct-preview--up">
                    {fmtP(livePrice * (1 + parseFloat(pctUp) / 100))}
                  </span>
                )}
              </div>
            </div>

            {/* Input form — direction: ltr (1:1 from source) */}
            <div className="sa-alert-form">

              {/* Bell icon + active count */}
              <div className="sa-alert-bell-wrap">
                <svg className="sa-alert-bell-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                {activeAlerts.length > 0 && (
                  <span className="sa-alert-bell-lbl">{activeAlerts.length}</span>
                )}
              </div>

              {/* Direction badge (click to toggle) */}
              <button
                className={`sa-alert-dir-badge${isBelow ? ' sa-alert-dir-badge--loss' : ''}`}
                onClick={() => setDirection(d => d === 'above' ? 'below' : 'above')}>
                {isBelow ? '↓ STOP' : '↑ TARGET'}
              </button>

              {/* Price input */}
              <input className="sa-alert-input"
                type="number"
                placeholder={livePrice ? fmtP(livePrice) : '0.00'}
                value={inputVal}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />

              {/* ▲▼ step arrows with hold-repeat */}
              <div className="sa-alert-arrows">
                <button className="sa-alert-arr"
                  onMouseDown={() => stepStart('up')}
                  onMouseUp={stepEnd}
                  onMouseLeave={stepEnd}
                  onTouchStart={e => { e.preventDefault(); stepStart('up'); }}
                  onTouchEnd={stepEnd}>▲</button>
                <button className="sa-alert-arr"
                  onMouseDown={() => stepStart('down')}
                  onMouseUp={stepEnd}
                  onMouseLeave={stepEnd}
                  onTouchStart={e => { e.preventDefault(); stepStart('down'); }}
                  onTouchEnd={stepEnd}>▼</button>
              </div>

              {/* Add / Update button */}
              <button className="sa-alert-add-btn" onClick={handleAdd}>
                {editId ? '✓ עדכן' : '+ הוסף'}
              </button>

              {/* Cancel edit */}
              {editId && (
                <button className="sa-alert-cancel-edit" onClick={cancelEdit}>✕</button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BOTTOM — alert list ════════════════════════════ */}
        <div className="sa-alert-bottom">
          <div className="sa-alert-bottom-hdr">
            <span className="sa-alert-bottom-title">📋 התראות — {symbol}</span>
            <span className="sa-alert-bottom-count">{symAlerts.length}</span>
          </div>

          <div className="sa-alert-list">
            {symAlerts.length === 0 ? (
              <div className="sa-alert-empty">אין התראות ל-{symbol}</div>
            ) : symAlerts.map(a => {
              const fired  = a.triggered;
              const isLoss = a.direction === 'below';
              return (
                <div key={a.id}
                  className={`sa-alert-row${fired ? ' sa-alert-row--triggered' : ''}`}
                  onClick={() => !fired && enterEdit(a)}>
                  <span className={`sa-alert-row-dir${isLoss ? ' sa-alert-row-dir--loss' : ''}`}>
                    {a.direction === 'above' ? '↑' : '↓'}
                  </span>
                  <span className="sa-alert-row-price">
                    ${a.target.toLocaleString('en', { maximumFractionDigits: 4 })}
                  </span>
                  {fired && <span className="sa-alert-row-badge">🔔 הופעל</span>}
                  <button className="sa-alert-row-del"
                    onClick={e => { e.stopPropagation(); removeAlert(a.id); }}>✕</button>
                </div>
              );
            })}
          </div>

          {/* Compact strip — all-symbols overview (up to 10) */}
          {alerts.length > 0 && (
            <div className="sa-alert-strip">
              {alerts.slice(0, 10).map(a => (
                <div key={a.id} className="sa-alert-strip-item sa-alert-strip-item--btn"
                  onClick={() => selectSymbol(a.symbol)}>
                  <div className="sa-alert-strip-body">
                    <span className="sa-alert-strip-dot"
                      style={{ color: a.direction === 'below' ? '#f87171' : '#fbbf24' }}>●</span>
                    <span className="sa-alert-strip-price">
                      {a.symbol} {a.target.toLocaleString('en', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button className="sa-alert-strip-del"
                    onClick={e => { e.stopPropagation(); removeAlert(a.id); }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ FOOTER ════════════════════════════════════════ */}
        <div className="sa-alert-footer">
          <button className="sa-alert-apply-btn" onClick={handleStart}>
            <span className="sa-alert-apply-label">▶ START</span>
            <span className="sa-alert-apply-check">✓</span>
          </button>
          <button className="sa-alert-clear-sym-btn"
            onClick={() => setConfirmClearSym(true)}>
            נקה {symbol}
          </button>
          <button className="sa-alert-clear-all-btn"
            onClick={() => setConfirmClearAll(true)}>
            נקה הכל
          </button>
        </div>

        {/* ═══ CONFIRM: clear symbol ═════════════════════════ */}
        {confirmClearSym && (
          <div className="sa-clearall-confirm-overlay"
            onClick={() => setConfirmClearSym(false)}>
            <div className="sa-clearall-confirm-box"
              onClick={e => e.stopPropagation()}>
              <p className="sa-clearall-confirm-msg">
                מחק את כל התראות <strong>{symbol}</strong>?
              </p>
              <p className="sa-clearall-confirm-q">לא ניתן לבטל פעולה זו</p>
              <div className="sa-clearall-confirm-btns">
                <button className="sa-clearall-confirm-yes"
                  onClick={() => { clearSymbol(symbol); setConfirmClearSym(false); onClose?.(); }}>
                  כן, מחק
                </button>
                <button className="sa-clearall-confirm-no"
                  onClick={() => setConfirmClearSym(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONFIRM: clear all ════════════════════════════ */}
        {confirmClearAll && (
          <div className="sa-clearall-confirm-overlay"
            onClick={() => setConfirmClearAll(false)}>
            <div className="sa-clearall-confirm-box"
              onClick={e => e.stopPropagation()}>
              <p className="sa-clearall-confirm-msg">
                מחק את <strong>כל</strong> ההתראות?
              </p>
              <p className="sa-clearall-confirm-q">לא ניתן לבטל פעולה זו</p>
              <div className="sa-clearall-confirm-btns">
                <button className="sa-clearall-confirm-yes"
                  onClick={() => { clearAll(); setConfirmClearAll(false); onClose?.(); }}>
                  כן, מחק הכל
                </button>
                <button className="sa-clearall-confirm-no"
                  onClick={() => setConfirmClearAll(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}

      </div>
  );

  // Modal mode (default): dark overlay + centered dialog
  if (!embedded) {
    return (
      <div className="sa-alert-overlay" onClick={onClose}>
        {dialog}
      </div>
    );
  }

  // Embedded mode (AlertsPage): no overlay, dialog fills the page
  return (
    <div className="sa-alert-page-wrap">
      {dialog}
    </div>
  );
}
