import { useAlerts } from '../context/AlertsContext';
import './AlertBanner.css';

export default function AlertBanner() {
  const { toasts, dismissToast } = useAlerts();
  if (!toasts.length) return null;

  return (
    <div className="ab-container">
      {toasts.map(t => (
        <div key={t.id} className={`ab-toast ab-toast--${t.direction}`}>
          <span className="ab-bell">🔔</span>
          <div className="ab-body">
            <span className="ab-sym">{t.symbol}</span>
            <span className="ab-msg">{t.message}</span>
          </div>
          <button className="ab-close" onClick={() => dismissToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
