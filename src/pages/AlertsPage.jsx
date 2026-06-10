import { useState, useEffect, useRef } from 'react';
import { useAlerts, fetchLivePrice } from '../context/AlertsContext';
import './AlertsPage.css';

const QUICK_SYMS = ['BTC','ETH','SOL','AAPL','NVDA','TSLA','MSFT','GOOGL','AMZN','XAUUSD'];
const DUR_LABELS  = { forever:'תמיד', eod:'היום', year:'שנה' };

function timeAgo(ts) {
  if (!ts) return '';
  const m = (Date.now() - ts) / 60000;
  if (m < 2)    return 'עכשיו';
  if (m < 60)   return `לפני ${Math.round(m)} דק׳`;
  if (m < 1440) return `לפני ${Math.round(m/60)} שע׳`;
  return `לפני ${Math.round(m/1440)} ימים`;
}

// ── Compact inline form ────────────────────────────────────────
function AlertForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial;
  const [symbol,    setSymbol]    = useState(initial?.symbol    || 'BTC');
  const [customSym, setCustomSym] = useState('');
  const [direction, setDirection] = useState(initial?.direction || 'above');
  const [target,    setTarget]    = useState(initial ? String(initial.target) : '');
  const [duration,  setDuration]  = useState(initial?.duration  || 'forever');
  const [note,      setNote]      = useState(initial?.note      || '');
  const [error,     setError]     = useState('');
  const [livePrice, setLivePrice] = useState(null);
  const [priceLoad, setPriceLoad] = useState(false);
  const holdRef = useRef({ timer: null, interval: null });

  const finalSym = customSym.trim().toUpperCase() || symbol;

  useEffect(() => {
    setLivePrice(null);
    setPriceLoad(true);
    fetchLivePrice(finalSym)
      .then(p => { if (p) setLivePrice(p); })
      .catch(() => {})
      .finally(() => setPriceLoad(false));
  }, [finalSym]);

  const handleTargetChange = (val) => {
    setTarget(val);
    const t = parseFloat(val);
    if (livePrice && t > 0) setDirection(t >= livePrice ? 'above' : 'below');
  };

  const fillLivePrice = () => {
    if (!livePrice) return;
    const v = livePrice.toFixed(livePrice > 100 ? 2 : 4);
    handleTargetChange(v);
  };

  const stepStart = (dir) => {
    const step = () => setTarget(v => {
      const val = parseFloat(v) || 0;
      const inc = val < 1 ? 0.001 : val < 100 ? 0.01 : val < 1000 ? 1 : 10;
      const next = dir === 'up' ? val + inc : Math.max(0, val - inc);
      return next.toFixed(val < 1 ? 4 : val < 100 ? 2 : 0);
    });
    step();
    holdRef.current.timer = setTimeout(() => { holdRef.current.interval = setInterval(step, 70); }, 380);
  };
  const stepEnd = () => { clearTimeout(holdRef.current.timer); clearInterval(holdRef.current.interval); };

  const submit = () => {
    setError('');
    if (!finalSym)                              { setError('בחר סמל'); return; }
    if (!target || isNaN(+target) || +target<=0){ setError('הכנס מחיר'); return; }
    onSave({ symbol: finalSym, direction, target: +target, duration, note });
  };

  const typedT    = parseFloat(target);
  const isStopLoss = livePrice && typedT > 0 ? typedT < livePrice : direction === 'below';
  const distPct    = livePrice && typedT > 0
    ? Math.abs(((typedT - livePrice) / livePrice) * 100).toFixed(1)
    : null;

  return (
    <div className="al-pf">
      {/* Edit banner */}
      {isEdit && (
        <div className="al-pf-edit-banner">
          <span>✏️ עריכת <strong>{initial.symbol}</strong></span>
          <button onClick={onCancel}>ביטול ✕</button>
        </div>
      )}

      {/* Symbol selector */}
      {!isEdit && (
        <div className="al-pf-sym-row">
          {QUICK_SYMS.map(s => (
            <button key={s}
              className={`al-pf-sym ${finalSym===s&&!customSym?'--on':''}`}
              onClick={() => { setSymbol(s); setCustomSym(''); }}>
              {s}
            </button>
          ))}
          <input className="al-pf-custom" placeholder="סמל..."
            value={customSym} onChange={e => setCustomSym(e.target.value.toUpperCase())} />
        </div>
      )}

      {/* Price input + direction — same row */}
      <div className="al-pf-main-row">
        <button className="al-pf-step"
          onMouseDown={() => stepStart('down')} onMouseUp={stepEnd} onMouseLeave={stepEnd}
          onTouchStart={e => { e.preventDefault(); stepStart('down'); }} onTouchEnd={stepEnd}>▼</button>
        <input className="al-pf-input" type="number" placeholder="מחיר יעד"
          value={target} onChange={e => handleTargetChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} autoFocus={isEdit} />
        <button className="al-pf-step"
          onMouseDown={() => stepStart('up')} onMouseUp={stepEnd} onMouseLeave={stepEnd}
          onTouchStart={e => { e.preventDefault(); stepStart('up'); }} onTouchEnd={stepEnd}>▲</button>
        <button className={`al-pf-dir ${direction==='above'?'--above':''}`}
          onClick={() => setDirection('above')}>↑ מעל</button>
        <button className={`al-pf-dir ${direction==='below'?'--below':''}`}
          onClick={() => setDirection('below')}>↓ מתחת</button>
      </div>

      {/* Badge (compact) */}
      {target && typedT > 0 && (
        <div className={`al-pf-badge ${isStopLoss ? '--sl' : '--tp'}`}>
          {isStopLoss ? '🔴 STOP LOSS' : '🟡 TARGET'}
          {distPct && <span className="al-pf-badge-dist"> {isStopLoss?'▼':'▲'} {distPct}%</span>}
        </div>
      )}

      {/* Duration + note — same row */}
      <div className="al-pf-opts-row">
        {['forever','eod','year'].map(d => (
          <button key={d} className={`al-pf-dur ${duration===d?'--on':''}`}
            onClick={() => setDuration(d)}>{DUR_LABELS[d]}</button>
        ))}
        <input className="al-pf-note" placeholder="הערה (אופציונלי)"
          value={note} onChange={e => setNote(e.target.value)} maxLength={50} />
      </div>

      {/* Live price (clickable) + submit */}
      <div className="al-pf-bottom-row">
        <button
          type="button"
          className={`al-pf-liveprice ${livePrice ? '--clickable' : ''}`}
          onClick={fillLivePrice}
          disabled={!livePrice}
          title={livePrice ? `לחץ למלא: $${livePrice.toLocaleString()}` : ''}>
          {priceLoad
            ? <span className="al-pf-price-loading">טוען…</span>
            : livePrice
              ? <><span className="al-pf-price-label">מחיר ↙</span><span className="al-pf-price-val">${livePrice.toLocaleString('en',{maximumFractionDigits: livePrice>100?0:4})}</span></>
              : <span className="al-pf-price-label">—</span>
          }
        </button>
        {error && <span className="al-pf-err">{error}</span>}
        <button className="al-pf-submit" onClick={submit}>
          {isEdit ? '✓ עדכן' : '+ הוסף'}
        </button>
      </div>
    </div>
  );
}

// ── Alert card (compact) ───────────────────────────────────────
function AlertCard({ alert, onRemove, onReset, onEdit }) {
  const fired   = alert.triggered;
  const expired = fired && alert.expiredOut;

  return (
    <div className={`al-card ${fired ? (expired?'al-card--expired':'al-card--triggered') : ''}`}>
      <div className="al-card-left">
        <div className="al-card-top">
          <span className="al-card-symbol">{alert.symbol}</span>
          <span className={`al-dir-badge al-dir-badge--${alert.direction}`}>
            {alert.direction==='above' ? '↑ מעל' : '↓ מתחת'}
          </span>
          <span className="al-card-target">${alert.target.toLocaleString()}</span>
          {alert.note && <span className="al-card-note">{alert.note}</span>}
        </div>
        {fired && (
          <div className={`al-card-fired-info ${expired?'al-card-fired-info--expired':''}`}>
            {expired
              ? `⏰ פג תוקף · ${timeAgo(alert.triggeredAt)}`
              : `🔔 $${alert.triggeredPrice?.toLocaleString()} · ${timeAgo(alert.triggeredAt)}`}
          </div>
        )}
      </div>
      <div className="al-card-right">
        {!fired && <span className="al-status-dot" />}
        {fired  && <span>{expired ? '⏰' : '🔔'}</span>}
        <div className="al-card-actions">
          {!fired && <button className="al-card-edit"  onClick={() => onEdit(alert)}>✏️</button>}
          {fired  && <button className="al-card-reset" onClick={() => onReset(alert.id)}>↺</button>}
          <button className="al-card-del" onClick={() => onRemove(alert.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function AlertsPage() {
  const {
    alerts, addAlert, editAlert, removeAlert, resetAlert,
    activeCount, exportCSV, clearAll, markSeen,
  } = useAlerts();

  const [filter,          setFilter]          = useState('all');
  const [editing,         setEditing]         = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  // Mark fired alerts as seen when page opens
  useEffect(() => { markSeen(); }, [markSeen]);

  const handleSave = (data) => {
    if (editing) {
      editAlert(editing.id, { target: data.target, direction: data.direction, duration: data.duration, note: data.note });
      setEditing(null);
    } else {
      addAlert(data);
    }
  };

  const firedCount = alerts.filter(a => a.triggered).length;
  const filtered   = alerts.filter(a => {
    if (filter==='active')    return !a.triggered;
    if (filter==='triggered') return  a.triggered;
    return true;
  });

  return (
    <div className="al-panel">

      {/* Panel header */}
      <div className="al-ph">
        <span className="al-ph-title">🔔 התראות מחיר</span>
        <div className="al-ph-stats">
          <span className="al-ph-stat --active">{activeCount} פעיל</span>
          <span className="al-ph-stat --fired">{firedCount} הופעל</span>
        </div>
        <div className="al-ph-actions">
          {notifPerm==='default' && (
            <button className="al-ph-btn" onClick={() => Notification.requestPermission()} title="אפשר התראות">🔔</button>
          )}
          {notifPerm==='granted' && <span className="al-ph-notif-ok">✅</span>}
          {alerts.length > 0 && (
            <button className="al-ph-btn al-ph-btn--danger" onClick={() => setConfirmClearAll(true)} title="נקה הכל">🗑</button>
          )}
          {alerts.length > 0 && (
            <button className="al-ph-btn" onClick={exportCSV} title="ייצוא CSV">📤</button>
          )}
        </div>
      </div>

      {/* Compact form */}
      <AlertForm
        key={editing?.id || 'new'}
        initial={editing || null}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />

      {/* Filter tabs */}
      <div className="al-pfilter">
        {[['all','הכל'],['active','🟢 פעילות'],['triggered','🔔 הופעלו']].map(([id,lbl]) => (
          <button key={id}
            className={`al-pfilter-btn ${filter===id?'--on':''}`}
            onClick={() => setFilter(id)}>{lbl}</button>
        ))}
        <span className="al-pfilter-count">{filtered.length}</span>
      </div>

      {/* Scrollable list */}
      <div className="al-plist">
        {filtered.length === 0 ? (
          <div className="al-plist-empty">
            {alerts.length === 0
              ? <><div style={{fontSize:'2rem',marginBottom:6}}>🔔</div><div>עדיין אין התראות</div><div style={{fontSize:'0.72rem',marginTop:4,color:'var(--text-muted)'}}>הוסף את הראשונה בטופס למעלה</div></>
              : 'אין התראות בקטגוריה זו'}
          </div>
        ) : (
          filtered.map(a => (
            <AlertCard key={a.id} alert={a}
              onRemove={removeAlert}
              onReset={resetAlert}
              onEdit={a => { setEditing(a); }}
            />
          ))
        )}
      </div>

      {/* Confirm clear all */}
      {confirmClearAll && (
        <div className="al-confirm-overlay" onClick={() => setConfirmClearAll(false)}>
          <div className="al-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="al-confirm-text">מחק את כל ההתראות ({alerts.length})?</div>
            <div className="al-confirm-btns">
              <button className="al-confirm-yes" onClick={() => { clearAll(); setConfirmClearAll(false); }}>כן, מחק הכל</button>
              <button className="al-confirm-no"  onClick={() => setConfirmClearAll(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
