import { useState } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './QuickAlert.css';

export default function QuickAlert({ symbol, currentPrice, onClose }) {
  const { addAlert } = useAlerts();
  const [direction, setDirection] = useState('above');
  const [target,    setTarget]    = useState(
    currentPrice ? (direction === 'above'
      ? (currentPrice * 1.05).toFixed(2)
      : (currentPrice * 0.95).toFixed(2)) : ''
  );
  const [note,    setNote]    = useState('');
  const [success, setSuccess] = useState(false);

  const handleDirection = (dir) => {
    setDirection(dir);
    if (currentPrice) {
      setTarget(dir === 'above'
        ? (currentPrice * 1.05).toFixed(2)
        : (currentPrice * 0.95).toFixed(2));
    }
  };

  const submit = () => {
    if (!target || isNaN(parseFloat(target))) return;
    addAlert({ symbol, direction, target, note });
    setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose?.(); }, 1500);
  };

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-card" onClick={e => e.stopPropagation()}>

        <div className="qa-header">
          <div className="qa-title">
            <span className="qa-bell">🔔</span>
            <span>התראה על <strong>{symbol}</strong></span>
          </div>
          <button className="qa-close" onClick={onClose}>✕</button>
        </div>

        {currentPrice && (
          <div className="qa-current">
            מחיר נוכחי: <strong>${parseFloat(currentPrice).toLocaleString()}</strong>
          </div>
        )}

        {/* Direction */}
        <div className="qa-dir-row">
          <button
            className={`qa-dir-btn ${direction === 'above' ? 'qa-dir--above' : ''}`}
            onClick={() => handleDirection('above')}
          >📈 מעל</button>
          <button
            className={`qa-dir-btn ${direction === 'below' ? 'qa-dir--below' : ''}`}
            onClick={() => handleDirection('below')}
          >📉 מתחת</button>
        </div>

        {/* Target */}
        <input
          className="qa-input"
          type="number"
          placeholder="מחיר יעד"
          value={target}
          onChange={e => setTarget(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {/* Note */}
        <input
          className="qa-input qa-input--note"
          type="text"
          placeholder="הערה (אופציונלי)"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={50}
        />

        {success ? (
          <div className="qa-success">✅ התראה נוספה!</div>
        ) : (
          <button className="qa-submit" onClick={submit}>
            🔔 הוסף התראה
          </button>
        )}
      </div>
    </div>
  );
}
