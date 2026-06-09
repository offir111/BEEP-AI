import { useState } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './AlertsPage.css';

const QUICK_SYMBOLS = ['BTC','ETH','SOL','AAPL','NVDA','TSLA','MSFT','GOOGL','AMZN','XAUUSD'];

function timeAgo(ts) {
  if (!ts) return '';
  const m = (Date.now() - ts) / 60000;
  if (m < 2)    return 'עכשיו';
  if (m < 60)   return `לפני ${Math.round(m)} דק׳`;
  if (m < 1440) return `לפני ${Math.round(m/60)} שע׳`;
  return `לפני ${Math.round(m/1440)} ימים`;
}

const DURATION_LABELS = { forever:'♾ תמיד', eod:'📅 היום', year:'📆 שנה' };

// ── Add / Edit form ───────────────────────────────────────────
function AlertForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial;
  const [symbol,    setSymbol]    = useState(initial?.symbol    || 'BTC');
  const [customSym, setCustomSym] = useState('');
  const [direction, setDirection] = useState(initial?.direction || 'above');
  const [target,    setTarget]    = useState(initial ? String(initial.target) : '');
  const [duration,  setDuration]  = useState(initial?.duration  || 'forever');
  const [note,      setNote]      = useState(initial?.note      || '');
  const [error,     setError]     = useState('');

  const finalSym = customSym.trim().toUpperCase() || symbol;

  const submit = () => {
    setError('');
    if (!finalSym)                                 { setError('בחר סמל'); return; }
    if (!target || isNaN(+target) || +target <= 0) { setError('הכנס מחיר תקין'); return; }
    onSave({ symbol: finalSym, direction, target: +target, duration, note });
  };

  return (
    <div className="al-form-card">
      <h3 className="al-form-title">{isEdit ? '✏️ עריכת התראה' : '🔔 הוסף התראה'}</h3>

      {/* Symbol */}
      {!isEdit && (
        <div className="al-form-row">
          <label className="al-label">סמל</label>
          <div className="al-quick-syms">
            {QUICK_SYMBOLS.map(s => (
              <button key={s}
                className={`al-sym-btn ${finalSym===s&&!customSym?'al-sym-btn--on':''}`}
                onClick={()=>{setSymbol(s);setCustomSym('');}}>
                {s}
              </button>
            ))}
          </div>
          <input className="al-input" placeholder="הקלד סמל (AMZN, BNB...)"
            value={customSym} onChange={e=>setCustomSym(e.target.value.toUpperCase())}/>
        </div>
      )}

      {isEdit && (
        <div className="al-edit-sym">עורך: <strong style={{color:'var(--accent-gold)'}}>{initial.symbol}</strong></div>
      )}

      {/* Direction */}
      <div className="al-form-row">
        <label className="al-label">כיוון</label>
        <div className="al-direction-toggle">
          <button className={`al-dir-btn ${direction==='above'?'al-dir-btn--above':''}`}
            onClick={()=>setDirection('above')}>📈 מעל</button>
          <button className={`al-dir-btn ${direction==='below'?'al-dir-btn--below':''}`}
            onClick={()=>setDirection('below')}>📉 מתחת</button>
        </div>
      </div>

      {/* Price + step */}
      <div className="al-form-row">
        <label className="al-label">מחיר יעד</label>
        <div className="al-price-row">
          <button className="al-step" onClick={()=>setTarget(v=>String(Math.max(0.01,(+v||0)-(+v>100?1:0.01))))}>▼</button>
          <input className="al-input al-input--price" type="number" placeholder="מחיר יעד..."
            value={target} onChange={e=>setTarget(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus={isEdit}/>
          <button className="al-step" onClick={()=>setTarget(v=>String((+v||0)+(+v>100?1:0.01)))}>▲</button>
        </div>
      </div>

      {/* Duration */}
      <div className="al-form-row">
        <label className="al-label">תוקף</label>
        <div className="al-dur-row">
          {['forever','eod','year'].map(d=>(
            <button key={d} className={`al-dur-btn ${duration===d?'al-dur-btn--on':''}`}
              onClick={()=>setDuration(d)}>{DURATION_LABELS[d]}</button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="al-form-row">
        <label className="al-label">הערה (אופציונלי)</label>
        <input className="al-input" placeholder="לדוגמה: רמת פריצה, support..."
          value={note} onChange={e=>setNote(e.target.value)} maxLength={60}/>
      </div>

      {error && <div className="al-form-error">{error}</div>}

      <div className="al-form-btns">
        <button className="al-form-submit" onClick={submit}>
          {isEdit ? '✓ שמור שינויים' : '🔔 הוסף התראה'}
        </button>
        {isEdit && <button className="al-form-cancel" onClick={onCancel}>ביטול</button>}
      </div>

      <div className="al-form-hint">⚡ בדיקה כל 30 שניות · קול + רטט + browser notification</div>
    </div>
  );
}

// ── Alert card ─────────────────────────────────────────────────
// BUG-05: distinguish expiredOut alerts from price-triggered alerts
function AlertCard({ alert, onRemove, onReset, onEdit }) {
  const fired   = alert.triggered;
  const expired = fired && alert.expiredOut;

  return (
    <div className={`al-card ${fired ? (expired ? 'al-card--expired' : 'al-card--triggered') : ''}`}>
      <div className="al-card-left">
        <div className="al-card-top">
          <span className="al-card-symbol">{alert.symbol}</span>
          <span className={`al-dir-badge al-dir-badge--${alert.direction}`}>
            {alert.direction === 'above' ? '↑ מעל' : '↓ מתחת'}
          </span>
          <span className="al-card-target">${alert.target.toLocaleString()}</span>
        </div>
        <div className="al-card-meta">
          {alert.duration && alert.duration !== 'forever' &&
            <span className="al-meta-chip">{DURATION_LABELS[alert.duration]}</span>}
          {alert.note && <span className="al-card-note">{alert.note}</span>}
        </div>
        {fired && (
          <div className={`al-card-fired-info ${expired ? 'al-card-fired-info--expired' : ''}`}>
            {expired
              ? `⏰ פג תוקף · ${timeAgo(alert.triggeredAt)}`
              : `🔔 הופעל ב-$${alert.triggeredPrice?.toLocaleString()} · ${timeAgo(alert.triggeredAt)}`
            }
          </div>
        )}
      </div>

      <div className="al-card-right">
        {!fired && (
          <div className="al-card-status">
            <span className="al-status-dot" />
            <span className="al-status-txt">פעיל</span>
          </div>
        )}
        {fired && (
          <div className={`al-card-status ${expired ? 'al-card-status--expired' : 'al-card-status--fired'}`}>
            <span>{expired ? '⏰' : '🔔'}</span>
            <span className="al-status-txt">{expired ? 'פג תוקף' : 'הופעל'}</span>
          </div>
        )}
        <div className="al-card-actions">
          {!fired && (
            <button className="al-card-edit" onClick={() => onEdit(alert)} title="ערוך" aria-label="ערוך התראה">✏️</button>
          )}
          {fired && (
            <button className="al-card-reset" onClick={() => onReset(alert.id)} title="אפס" aria-label="אפס התראה">↺</button>
          )}
          <button className="al-card-del" onClick={() => onRemove(alert.id)} title="מחק" aria-label="מחק התראה">✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function AlertsPage() {
  const { alerts, addAlert, editAlert, removeAlert, resetAlert, activeCount, exportCSV } = useAlerts();
  const [filter,   setFilter]   = useState('all');
  const [editing,  setEditing]  = useState(null); // alert object being edited

  const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const handleSave = (data) => {
    if (editing) {
      editAlert(editing.id, data.target);
      setEditing(null);
    } else {
      addAlert(data);
    }
  };

  const filtered = alerts.filter(a => {
    if (filter==='active')    return !a.triggered;
    if (filter==='triggered') return  a.triggered;
    return true;
  });

  return (
    <div className="al-wrap">

      {/* Header */}
      <div className="al-hdr">
        <div>
          <h2 className="al-title">🔔 התראות מחיר</h2>
          <p className="al-sub">קבל התראה קולית + ויזואלית כשמחיר מגיע ליעד</p>
        </div>
        <div className="al-hdr-btns">
          {notifPerm === 'default' && (
            <button className="al-notif-btn" onClick={()=>Notification.requestPermission()}>
              🔔 אפשר Notifications
            </button>
          )}
          {notifPerm === 'granted' && <div className="al-notif-ok">✅ Notifications פעיל</div>}
          {alerts.length > 0 && (
            <button className="al-export-btn" onClick={exportCSV} title="ייצוא CSV">📤 CSV</button>
          )}
        </div>
      </div>

      {/* Add / Edit form */}
      <AlertForm
        key={editing?.id || 'new'}
        initial={editing || null}
        onSave={handleSave}
        onCancel={()=>setEditing(null)}
      />

      {/* Stats */}
      <div className="al-stats">
        {[
          { num: alerts.length,                              lbl: 'סה״כ',    cls: '' },
          { num: activeCount,                                lbl: 'פעילות',  cls: 'al-stat-num--active' },
          { num: alerts.filter(a=>a.triggered).length,      lbl: 'הופעלו',  cls: 'al-stat-num--fired'  },
        ].map(s => (
          <div key={s.lbl} className="al-stat">
            <span className={`al-stat-num ${s.cls}`}>{s.num}</span>
            <span className="al-stat-lbl">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      {alerts.length > 0 && (
        <div className="al-filter">
          {[['all','הכל'],['active','🟢 פעילות'],['triggered','🔔 הופעלו']].map(([id,lbl])=>(
            <button key={id} className={`al-filter-btn ${filter===id?'al-filter-btn--on':''}`}
              onClick={()=>setFilter(id)}>{lbl}</button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="al-empty">
          {alerts.length === 0
            ? <><div style={{fontSize:'2.5rem',marginBottom:8}}>🔔</div><div>עדיין אין התראות</div><div style={{fontSize:'0.78rem',marginTop:4,color:'var(--text-muted)'}}>הוסף את הראשונה בטופס למעלה</div></>
            : 'אין התראות בקטגוריה זו'}
        </div>
      ) : (
        <div className="al-list">
          {filtered.map(a=>(
            <AlertCard key={a.id} alert={a}
              onRemove={removeAlert} onReset={resetAlert}
              onEdit={a => { setEditing(a); window.scrollTo(0,0); }}/>
          ))}
        </div>
      )}

    </div>
  );
}
