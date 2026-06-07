import { useState } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './AlertsPage.css';

const QUICK_SYMBOLS = ['BTC','ETH','SOL','AAPL','NVDA','TSLA','MSFT','GOOGL','AMZN','XAUUSD'];

function timeAgo(ts) {
  if (!ts) return '';
  const m = (Date.now() - ts) / 60000;
  if (m < 2)    return 'עכשיו';
  if (m < 60)   return `לפני ${Math.round(m)} דק׳`;
  if (m < 1440) return `לפני ${Math.round(m / 60)} שע׳`;
  return `לפני ${Math.round(m / 1440)} ימים`;
}

function AddAlertForm({ onAdd }) {
  const [symbol,    setSymbol]    = useState('BTC');
  const [customSym, setCustomSym] = useState('');
  const [direction, setDirection] = useState('above');
  const [target,    setTarget]    = useState('');
  const [note,      setNote]      = useState('');
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const finalSymbol = customSym.trim().toUpperCase() || symbol;

  const submit = () => {
    setError('');
    if (!finalSymbol) { setError('בחר סמל'); return; }
    if (!target || isNaN(parseFloat(target)) || parseFloat(target) <= 0) {
      setError('הכנס מחיר יעד תקין'); return;
    }
    onAdd({ symbol: finalSymbol, direction, target, note });
    setTarget('');
    setNote('');
    setCustomSym('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="al-form-card">
      <h3 className="al-form-title">🔔 הוסף התראה חדשה</h3>

      {/* Quick symbol selector */}
      <div className="al-form-row">
        <label className="al-label">סמל</label>
        <div className="al-quick-syms">
          {QUICK_SYMBOLS.map(s => (
            <button
              key={s}
              className={`al-sym-btn ${finalSymbol === s && !customSym ? 'al-sym-btn--on' : ''}`}
              onClick={() => { setSymbol(s); setCustomSym(''); }}
            >{s}</button>
          ))}
        </div>
        <input
          className="al-input"
          placeholder="או הקלד סמל מותאם... (AMZN, ETH...)"
          value={customSym}
          onChange={e => setCustomSym(e.target.value.toUpperCase())}
        />
      </div>

      {/* Direction */}
      <div className="al-form-row">
        <label className="al-label">כיוון</label>
        <div className="al-direction-toggle">
          <button
            className={`al-dir-btn ${direction === 'above' ? 'al-dir-btn--above' : ''}`}
            onClick={() => setDirection('above')}
          >📈 מעל (Above)</button>
          <button
            className={`al-dir-btn ${direction === 'below' ? 'al-dir-btn--below' : ''}`}
            onClick={() => setDirection('below')}
          >📉 מתחת (Below)</button>
        </div>
      </div>

      {/* Target price */}
      <div className="al-form-row">
        <label className="al-label">מחיר יעד</label>
        <input
          className="al-input al-input--price"
          type="number"
          placeholder={`כאשר ${finalSymbol} יגיע ל...`}
          value={target}
          onChange={e => setTarget(e.target.value)}
          min="0"
          step="any"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>

      {/* Note (optional) */}
      <div className="al-form-row">
        <label className="al-label">הערה (אופציונלי)</label>
        <input
          className="al-input"
          placeholder="לדוגמה: רמת פריצה, support..."
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={60}
        />
      </div>

      {error   && <div className="al-form-error">{error}</div>}
      {success && <div className="al-form-success">✅ התראה נוספה בהצלחה!</div>}

      <button className="al-form-submit" onClick={submit}>
        🔔 הוסף התראה
      </button>

      <div className="al-form-hint">
        ⚡ בדיקת מחיר כל 30 שניות · התראה קולית + חזותית + browser notification
      </div>
    </div>
  );
}

function AlertCard({ alert, onRemove, onReset }) {
  const isTriggered = alert.triggered;
  return (
    <div className={`al-card ${isTriggered ? 'al-card--triggered' : ''}`}>
      <div className="al-card-left">
        <div className="al-card-symbol">{alert.symbol}</div>
        <div className="al-card-dir">
          <span className={`al-dir-badge al-dir-badge--${alert.direction}`}>
            {alert.direction === 'above' ? '↑ מעל' : '↓ מתחת'}
          </span>
          <span className="al-card-target">${alert.target.toLocaleString()}</span>
        </div>
        {alert.note && <div className="al-card-note">{alert.note}</div>}
      </div>

      <div className="al-card-right">
        {isTriggered ? (
          <div className="al-card-fired">
            <span className="al-fired-badge">🔔 הופעל!</span>
            <span className="al-fired-price">${alert.triggeredPrice?.toLocaleString()}</span>
            <span className="al-fired-time">{timeAgo(alert.triggeredAt)}</span>
            <button className="al-card-reset" onClick={() => onReset(alert.id)} title="אפס">↺ אפס</button>
          </div>
        ) : (
          <div className="al-card-status">
            <span className="al-status-dot" />
            <span className="al-status-txt">פעיל</span>
          </div>
        )}
        <button className="al-card-del" onClick={() => onRemove(alert.id)} title="מחק">✕</button>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { alerts, addAlert, removeAlert, resetAlert, activeCount } = useAlerts();
  const [filter, setFilter] = useState('all'); // all | active | triggered

  const notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const requestNotif = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'active')    return !a.triggered;
    if (filter === 'triggered') return  a.triggered;
    return true;
  });

  return (
    <div className="al-wrap">

      {/* Header */}
      <div className="al-hdr">
        <div>
          <h2 className="al-title">🔔 התראות מחיר</h2>
          <p className="al-sub">קבל התראה קולית וויזואלית כשמחיר מגיע ליעד</p>
        </div>
        {notifPermission === 'default' && (
          <button className="al-notif-btn" onClick={requestNotif}>
            🔔 אפשר Push Notifications
          </button>
        )}
        {notifPermission === 'granted' && (
          <div className="al-notif-ok">✅ Notifications פעיל</div>
        )}
      </div>

      {/* Add form */}
      <AddAlertForm onAdd={addAlert} />

      {/* Stats bar */}
      <div className="al-stats">
        <div className="al-stat">
          <span className="al-stat-num">{alerts.length}</span>
          <span className="al-stat-lbl">סה״כ</span>
        </div>
        <div className="al-stat">
          <span className="al-stat-num al-stat-num--active">{activeCount}</span>
          <span className="al-stat-lbl">פעילות</span>
        </div>
        <div className="al-stat">
          <span className="al-stat-num al-stat-num--fired">{alerts.filter(a => a.triggered).length}</span>
          <span className="al-stat-lbl">הופעלו</span>
        </div>
      </div>

      {/* Filter */}
      {alerts.length > 0 && (
        <div className="al-filter">
          {[
            { id: 'all',       label: 'הכל'      },
            { id: 'active',    label: '🟢 פעילות' },
            { id: 'triggered', label: '🔔 הופעלו' },
          ].map(f => (
            <button
              key={f.id}
              className={`al-filter-btn ${filter === f.id ? 'al-filter-btn--on' : ''}`}
              onClick={() => setFilter(f.id)}
            >{f.label}</button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="al-empty">
          {alerts.length === 0
            ? '💡 עדיין אין התראות — הוסף את הראשונה למעלה'
            : 'אין התראות בקטגוריה זו'}
        </div>
      ) : (
        <div className="al-list">
          {filtered.map(a => (
            <AlertCard
              key={a.id}
              alert={a}
              onRemove={removeAlert}
              onReset={resetAlert}
            />
          ))}
        </div>
      )}

    </div>
  );
}
