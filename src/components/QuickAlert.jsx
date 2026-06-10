import { useState, useEffect, useRef } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './QuickAlert.css';

export default function QuickAlert({ symbol: initSymbol, currentPrice: initPrice, onClose }) {
  const { alerts, addAlert, editAlert, removeAlert, fixedSlots, customSlots, clearSymbol, clearAll } = useAlerts();

  const [symbol,    setSymbol]    = useState(initSymbol || 'BTC');
  const [price,     setPrice]     = useState(initPrice || null);
  const [direction, setDirection] = useState('above');
  const [target,    setTarget]    = useState('');
  const [duration,  setDuration]  = useState('forever');
  const [note,      setNote]      = useState('');
  const [editId,          setEditId]          = useState(null);
  const [success,         setSuccess]         = useState(false);
  const [dupWarn,         setDupWarn]         = useState(false);
  const [confirmClearSym, setConfirmClearSym] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const holdRef = useRef({ timer: null, interval: null });

  // Init price when symbol/price changes
  useEffect(() => {
    if (initPrice) {
      setPrice(initPrice);
      setTarget((initPrice * 1.05).toFixed(initPrice > 100 ? 2 : 4));
      setDirection('above');
    }
  }, [initPrice]);

  // ── Auto-detect direction when user types target price ──────
  const handleTargetChange = (val) => {
    setTarget(val);
    const t = parseFloat(val);
    if (price && t > 0) {
      setDirection(t >= price ? 'above' : 'below');
    }
  };

  // Dynamic badge: TARGET (🟡) or STOP LOSS (🔴)
  const typedT = parseFloat(target);
  const autoType = price && typedT > 0
    ? (typedT >= price ? 'target' : 'stoploss')
    : (direction === 'above' ? 'target' : 'stoploss');
  const isStopLoss = autoType === 'stoploss';

  const handleDirection = (dir) => {
    setDirection(dir);
    if (price) setTarget((dir === 'above' ? price * 1.05 : price * 0.95).toFixed(price > 100 ? 2 : 4));
  };

  // Existing alerts for this symbol
  const symAlerts = alerts.filter(a => a.symbol === symbol.toUpperCase() && !a.triggered);

  // Click existing alert chip → edit mode
  const enterEdit = (alert) => {
    setEditId(alert.id);
    setDirection(alert.direction);
    setTarget(String(alert.target));
    setNote(alert.note || '');
    setDuration(alert.duration || 'forever');
  };

  const cancelEdit = () => {
    setEditId(null);
    setTarget(price ? (price * 1.05).toFixed(price > 100 ? 2 : 4) : '');
    setNote('');
  };

  // ── Hold-repeat for ▲▼ step buttons ──
  const stepStart = (dir) => {
    const step = () => {
      setTarget(v => {
        const val = parseFloat(v) || 0;
        const inc = val < 1 ? 0.001 : val < 100 ? 0.01 : val < 1000 ? 1 : 10;
        const next = dir === 'up' ? val + inc : Math.max(0, val - inc);
        return next.toFixed(val < 1 ? 4 : val < 100 ? 2 : 0);
      });
    };
    step();
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.interval = setInterval(step, 70);
    }, 380);
  };
  const stepEnd = () => {
    clearTimeout(holdRef.current.timer);
    clearInterval(holdRef.current.interval);
  };

  // ── START: add alert and close immediately ──
  const handleStart = () => {
    const t = parseFloat(target);
    if (!t || isNaN(t) || t <= 0) return;
    if (editId) {
      editAlert(editId, { target: t, direction, duration, note });
    } else {
      const result = addAlert({ symbol: symbol.toUpperCase(), direction, target: t, duration, note });
      if (result === null) {
        setDupWarn(true);
        setTimeout(() => setDupWarn(false), 2500);
        return;
      }
    }
    onClose?.();
  };

  const submit = () => {
    const t = parseFloat(target);
    if (!t || isNaN(t) || t <= 0) return;

    if (editId) {
      editAlert(editId, { target: t, direction, duration, note });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setEditId(null); }, 1200);
    } else {
      const result = addAlert({ symbol: symbol.toUpperCase(), direction, target: t, duration, note });
      if (result === null) {
        setDupWarn(true);
        setTimeout(() => setDupWarn(false), 2500);
        return;
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose?.(); }, 1200);
    }
  };

  const allSlots = [...fixedSlots, ...customSlots].filter(Boolean);

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="qa-hdr">
          <div className="qa-title">🔔 התראה — <strong>{symbol}</strong></div>
          <button className="qa-close" onClick={onClose} aria-label="סגור חלון התראה">✕</button>
        </div>

        {/* Slot shortcuts */}
        <div className="qa-slots">
          {allSlots.map((s, i) => (
            <button key={i} className={`qa-slot ${symbol === s ? 'qa-slot--on' : ''}`}
              onClick={() => { setSymbol(s); setEditId(null); }}>{s}</button>
          ))}
        </div>

        {/* Current price */}
        {price && (
          <div className="qa-current">
            מחיר נוכחי: <strong style={{ color:'#D4AF37' }}>${parseFloat(price).toLocaleString()}</strong>
            <button className="qa-use-price" onClick={() => setTarget(String(parseFloat(price).toFixed(price > 100 ? 2 : 4)))}>
              השתמש
            </button>
          </div>
        )}

        {/* Auto-type badge — TARGET vs STOP LOSS */}
        {target && (
          <div className={`qa-type-badge ${isStopLoss ? 'qa-badge--sl' : 'qa-badge--tp'}`}>
            <span className="qa-badge-icon">{isStopLoss ? '🔴' : '🟡'}</span>
            <span className="qa-badge-text">{isStopLoss ? 'STOP LOSS' : 'TARGET'}</span>
            {price && typedT > 0 && (
              <span className="qa-badge-dist">
                {isStopLoss ? '▼' : '▲'} {Math.abs(((typedT - price) / price) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {/* Existing alerts chips */}
        {symAlerts.length > 0 && (
          <div className="qa-chips-wrap">
            <span className="qa-chips-lbl">התראות קיימות:</span>
            <div className="qa-chips">
              {symAlerts.map(a => (
                <div key={a.id} className={`qa-chip qa-chip--${a.direction} ${editId === a.id ? 'qa-chip--edit' : ''}`}>
                  <button className="qa-chip-body" onClick={() => editId === a.id ? cancelEdit() : enterEdit(a)}>
                    {a.direction === 'above' ? '↑' : '↓'} ${a.target.toLocaleString()}
                  </button>
                  <button className="qa-chip-del" onClick={() => removeAlert(a.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit mode banner */}
        {editId && (
          <div className="qa-edit-banner">
            ✏️ מצב עריכה — שנה את המחיר ולחץ עדכן
            <button onClick={cancelEdit}>בטל</button>
          </div>
        )}

        {/* Direction */}
        <div className="qa-dir-row">
          <button className={`qa-dir-btn ${direction==='above'?'qa-dir--above':''}`} onClick={()=>handleDirection('above')}>📈 מעל</button>
          <button className={`qa-dir-btn ${direction==='below'?'qa-dir--below':''}`} onClick={()=>handleDirection('below')}>📉 מתחת</button>
        </div>

        {/* Target price input */}
        <div className="qa-input-row">
          <button className="qa-step-btn"
            onMouseDown={() => stepStart('down')} onMouseUp={stepEnd} onMouseLeave={stepEnd}
            onTouchStart={e => { e.preventDefault(); stepStart('down'); }} onTouchEnd={stepEnd}>▼</button>
          <input
            className="qa-input"
            type="number"
            placeholder="מחיר יעד"
            value={target}
            onChange={e => handleTargetChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
          <button className="qa-step-btn"
            onMouseDown={() => stepStart('up')} onMouseUp={stepEnd} onMouseLeave={stepEnd}
            onTouchStart={e => { e.preventDefault(); stepStart('up'); }} onTouchEnd={stepEnd}>▲</button>
        </div>

        {/* Duration */}
        <div className="qa-dur-row">
          {[['forever','♾ תמיד'],['eod','📅 היום'],['year','📆 שנה']].map(([d,l]) => (
            <button key={d} className={`qa-dur-btn ${duration===d?'qa-dur--on':''}`} onClick={()=>setDuration(d)}>{l}</button>
          ))}
        </div>

        {/* Note */}
        <input className="qa-input qa-input--note" type="text" placeholder="הערה (אופציונלי)"
          value={note} onChange={e=>setNote(e.target.value)} maxLength={50} />

        {dupWarn && (
          <div className="qa-dup-warn">⚠️ התראה זהה כבר קיימת לסמל זה</div>
        )}
        {success ? (
          <div className="qa-success">✅ {editId ? 'עודכן!' : 'נוסף!'}</div>
        ) : (
          <button className="qa-submit" onClick={submit} disabled={dupWarn}>
            {editId ? '✓ עדכן התראה' : '🔔 הוסף התראה'}
          </button>
        )}

        {/* Footer: START + clear buttons */}
        <div className="qa-footer">
          <button className="qa-start-btn" onClick={handleStart} title="הוסף וסגור">▶ START</button>
          <button className="qa-clear-sym-btn" onClick={() => setConfirmClearSym(true)}>נקה {symbol}</button>
          <button className="qa-clear-all-btn" onClick={() => setConfirmClearAll(true)}>נקה הכל</button>
        </div>

        {/* Confirm clear symbol */}
        {confirmClearSym && (
          <div className="qa-confirm-overlay" onClick={() => setConfirmClearSym(false)}>
            <div className="qa-confirm-box" onClick={e => e.stopPropagation()}>
              <div className="qa-confirm-text">מחק את כל התראות {symbol}?</div>
              <div className="qa-confirm-btns">
                <button className="qa-confirm-yes" onClick={() => { clearSymbol(symbol); setConfirmClearSym(false); onClose?.(); }}>כן, מחק</button>
                <button className="qa-confirm-no"  onClick={() => setConfirmClearSym(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm clear all */}
        {confirmClearAll && (
          <div className="qa-confirm-overlay" onClick={() => setConfirmClearAll(false)}>
            <div className="qa-confirm-box" onClick={e => e.stopPropagation()}>
              <div className="qa-confirm-text">מחק את כל ההתראות?</div>
              <div className="qa-confirm-btns">
                <button className="qa-confirm-yes" onClick={() => { clearAll(); setConfirmClearAll(false); onClose?.(); }}>כן, מחק הכל</button>
                <button className="qa-confirm-no"  onClick={() => setConfirmClearAll(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
