import { useEffect } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './AlertBanner.css';

export default function AlertBanner() {
  const { banner, clearBanner } = useAlerts();

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(clearBanner, 8000);
    return () => clearTimeout(t);
  }, [banner, clearBanner]);

  if (!banner) return null;

  return (
    <div className="alert-banner" onClick={clearBanner}>
      <span className="alert-banner-icon">🔔</span>
      <div className="alert-banner-body">
        <span className="alert-banner-sym">{banner.symbol}</span>
        <span className="alert-banner-msg">{banner.message}</span>
      </div>
      <button className="alert-banner-close" onClick={clearBanner}>✕</button>
    </div>
  );
}
