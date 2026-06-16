/**
 * QuickAlert.jsx — 1:1 clone of S.T.B alerts dialog (dl() component)
 * Color-adapted to beep-ai palette. All dimensions, layout, features,
 * logic and animations are identical to source.
 *
 * Source: C:\Users\Admin\Downloads\S.T.B\live\index-BrRuZL4L-v104.js
 * READ ONLY (no source modifications)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAlerts } from '../context/AlertsContext';
import { apiUrl } from '../utils/apiBase';
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
  onSymbolChange,              // callback(sym) when user switches symbol inside the dialog
  stockGainers  = [],
  cryptoGainers = [],
  embedded      = false,       // true → renders inline (no overlay)
  contained     = false,       // true → overlay is position:absolute (stays inside a bounded parent)
}) {
  const {
    alerts, addAlert, editAlert, removeAlert,
    fixedSlots, setFixedSlots,
    customSlots, setCustomSlots,
    clearSymbol, clearAll,
  } = useAlerts();

  /* ── Symbol / live price ─────────────────────────────────── */
  const [symbol,       setSymbol]       = useState(initSymbol);

  // ── Live price — simple fetch once on mount ──────────────────
  const [livePrice,    setLivePrice]    = useState(initPrice);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const livePriceRef = useRef(initPrice);
  useEffect(() => { livePriceRef.current = livePrice; }, [livePrice]);

  useEffect(() => {
    if (initPrice) { setLivePrice(initPrice); return; }
    if (!symbol) return;
    let cancelled = false;
    setLoadingPrice(true);
    const isCrypto = ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','DOT','AVAX','MATIC'].includes(symbol.toUpperCase());
    (isCrypto
      ? fetch(apiUrl(`/api/binance?ep=ticker/price&symbol=${symbol.toUpperCase()}USDT`)).then(r=>r.json()).then(d=>parseFloat(d.price))
      : fetch(apiUrl(`/api/market?symbol=${encodeURIComponent(symbol)}`)).then(r=>r.json()).then(d=>d.price ? parseFloat(d.price) : null)
    ).then(p => { if (!cancelled && p) { setLivePrice(p); setLoadingPrice(false); } })
     .catch(() => { if (!cancelled) setLoadingPrice(false); });
    return () => { cancelled = true; };
  }, [symbol, initPrice]);

  /* ── Symbol search / scan ────────────────────────────────── */
  const [searchVal, setSearchVal] = useState('');
  const doScan = () => {
    const s = searchVal.trim().toUpperCase();
    if (!s) return;
    selectSymbol(s);      // loads price + updates chart via onSymbolChange
    setSearchVal('');
  };

  /* ── Form state ──────────────────────────────────────────── */
  const [inputVal,  setInputVal]  = useState('');
  const [direction, setDirection] = useState('above');
  const [duration,  setDuration]  = useState('year');   // 'eod' | 'year'
  const [editId,    setEditId]    = useState(null);

  /* ── Slots edit mode ─────────────────────────────────────── */
  const [slotsEditMode, setSlotsEditMode] = useState(false);
  const [editingSlot,   setEditingSlot]   = useState(null); // {type:'fixed'|'custom', idx}
  const [slotInput,     setSlotInput]     = useState('');

  /* ── Confirm overlays ────────────────────────────────────── */
  const [confirmClearSym, setConfirmClearSym] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  /* ── Duplicate flash ─────────────────────────────────────── */
  const [dupFlash, setDupFlash] = useState(false);

  /* ── Self-fetched gainers (when no props passed) ─────────── */
  const [selfGainers, setSelfGainers] = useState([]);

  /* ── Hold-repeat refs ────────────────────────────────────── */
  const holdRef = useRef({ timer: null, interval: null });

  /* ── Fetch top crypto movers once on mount (gainers tabs) ── */
  useEffect(() => {
    if (cryptoGainers.length > 0) return; // use prop when provided
    const SYMS = ['BTC','ETH','SOL','BNB','XRP'];
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMS.map(s => s + 'USDT')))}`)
      .then(r => r.json())
      .then(data => {
        const top = data
          .map(t => ({ symbol: t.symbol.replace('USDT',''), changePercent: parseFloat(t.priceChangePercent) }))
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
          .slice(0, 3);
        setSelfGainers(top);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ── Compute correct direction from price relationship ────── */
  // ALWAYS derive direction from target vs live price (prevents false triggers).
  // If no live price is available, fall back to the auto-detected direction state.
  const resolveDirection = (target) =>
    livePrice ? (target < livePrice ? 'below' : 'above') : direction;

  /* ── Add / update alert ──────────────────────────────────── */
  const handleAdd = () => {
    const t = parseFloat(inputVal);
    if (!t || t <= 0) return;
    const safeDir = resolveDirection(t);
    if (editId) {
      editAlert(editId, { target: t, direction: safeDir, duration });
      setEditId(null);
      setInputVal('');
    } else {
      const result = addAlert({ symbol: symbol.toUpperCase(), direction: safeDir, target: t, duration, note: '' });
      if (result === null) {
        // Duplicate — flash input red
        setDupFlash(true);
        setTimeout(() => setDupFlash(false), 900);
        return;
      }
      setInputVal('');
      // Request OS notification permission on first successful add (requires user gesture)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  };

  /* ── START: add (if input present) then ALWAYS close ────── */
  // Matches S.T.B: START always calls onClose even when input is empty.
  const handleStart = () => {
    const t = parseFloat(inputVal);
    if (t && t > 0) {
      // There is a valid target — add or update the alert
      const safeDir = resolveDirection(t);
      if (editId) {
        editAlert(editId, { target: t, direction: safeDir, duration });
        setEditId(null);
      } else {
        const result = addAlert({ symbol: symbol.toUpperCase(), direction: safeDir, target: t, duration, note: '' });
        if (result === null) {
          // Duplicate — flash input, stay open (don't close)
          setDupFlash(true);
          setTimeout(() => setDupFlash(false), 900);
          return;
        }
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
      setInputVal('');
    }
    // ALWAYS close — even when input was empty (S.T.B behavior)
    onClose?.();
  };

  /* ── Enter / cancel edit ─────────────────────────────────── */
  const enterEdit = (a) => {
    setEditId(a.id);
    const { dec } = getStep(a.target);
    setInputVal(a.target.toFixed(dec));
    setDirection(a.direction);
    setDuration(a.duration || 'year');
  };
  const cancelEdit = () => { setEditId(null); setInputVal(''); };

  /* ── Select symbol ───────────────────────────────────────── */
  const selectSymbol = (sym) => {
    const s = sym.toUpperCase();
    setSymbol(s);
    setEditId(null);
    setInputVal('');
    onSymbolChange?.(s);  // notify parent (AlertsPage) to update chart
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

  /* ── Gainers tabs (props → self-fetched fallback) ───────── */
  const gainerTabs = [
    ...(cryptoGainers.length > 0 ? cryptoGainers : selfGainers).slice(0, 3).map(g => ({
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

            {/* Symbol search + scan */}
            <div className="sa-alert-search">
              <input
                className="sa-alert-search-input"
                type="text"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') doScan(); }}
                placeholder="AAPL · NVDA · TSLA"
                dir="ltr"
              />
              <button className="sa-alert-scan-btn" onClick={doScan}>🔍 סרוק</button>
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
                  <span className="sa-alert-current-price">
                    {fmtP(livePrice)}
                  </span>
                  <span className="sa-alert-current-sym-tag">{symbol}</span>
                </>
              ) : (
                <>
                  <span className="sa-alert-current-loading">—</span>
                  <span className="sa-alert-current-sym-tag">{symbol}</span>
                </>
              )}
            </button>

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

              {/* Price input */}
              <input className={`sa-alert-input${dupFlash ? ' --dup' : ''}`}
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

        {/* ═══ STRIP — active alerts for current symbol only ══ */}
        {activeAlerts.length > 0 && (
          <div className="sa-alert-strip">
            {activeAlerts.map(a => {
              const { dec } = getStep(a.target);
              return (
                <div key={a.id} className={`sa-alert-strip-item sa-alert-strip-item--btn${editId === a.id ? ' --editing' : ''}`}
                  onClick={() => enterEdit(a)}>
                  <div className="sa-alert-strip-body">
                    <span className="sa-alert-strip-dot"
                      style={{ color: a.direction === 'below' ? '#f87171' : '#fbbf24' }}>●</span>
                    <span className="sa-alert-strip-price">
                      {a.target.toFixed(dec)}
                    </span>
                  </div>
                  <button className="sa-alert-strip-del"
                    onClick={e => { e.stopPropagation(); removeAlert(a.id); }}>✕</button>
                </div>
              );
            })}
          </div>
        )}

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
  // contained=true → overlay is position:absolute (stays inside its bounded parent)
  if (!embedded) {
    return (
      <div
        className={`sa-alert-overlay${contained ? ' sa-alert-overlay--contained' : ''}`}
        onClick={onClose}
      >
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
