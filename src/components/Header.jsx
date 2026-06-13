import { useState, useEffect } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './Header.css';

function IsraelClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }) + ' IST');
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hdr-clock">{time}</span>;
}

export default function Header({ username, onLogout, navigate, page }) {
  const { activeCount, unseenFired } = useAlerts();

  return (
    <header className="hdr">
      {/* Brand — same logo as BEEP BEEP; click = home from anywhere */}
      <div className="hdr-brand" onClick={() => navigate('home')} role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('home'); }}
           title="דף הבית">
        <div className="hdr-logo-circle">
          <div className="hdr-logo-head" />
          <div className="hdr-logo-beep-wrap">
            <span className="hdr-logo-beep hdr-logo-beep-top">BEEP</span>
            <span className="hdr-logo-beep">BEEP</span>
          </div>
        </div>
      </div>

      <div className="hdr-center" />

      {/* Right side */}
      <div className="hdr-right">
        <IsraelClock />

        {/* Bell button */}
        <button
          className={`hdr-bell ${page === 'alerts' ? 'hdr-bell--on' : ''}`}
          onClick={() => navigate('alerts')}
          title="התראות מחיר"
          aria-label={`התראות מחיר${activeCount > 0 ? ` — ${activeCount} פעילות` : ''}`}
          aria-current={page === 'alerts' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" className="hdr-bell-icon">
            <path d="M12 2C10.9 2 10 2.9 10 4v.55C7.16 5.24 5 7.9 5 11v6l-1.71 1.71A1 1 0 0 0 4 20h16a1 1 0 0 0 .71-1.71L19 17v-6c0-3.1-2.16-5.76-5-6.45V4c0-1.1-.9-2-2-2zm0 20c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z"/>
          </svg>
          {activeCount > 0 && (
            <span className="hdr-bell-badge">{activeCount > 9 ? '9+' : activeCount}</span>
          )}
          {unseenFired > 0 && (
            <span className="hdr-bell-fired" title={`${unseenFired} התראות חדשות`} />
          )}
        </button>

        {/* User */}
        <div className="hdr-user" title={username}>
          <span className="hdr-avatar">{username?.[0]?.toUpperCase()}</span>
          <span className="hdr-username">{username}</span>
        </div>

        <button className="hdr-logout" onClick={onLogout} title="התנתק" aria-label="התנתק מהמערכת">✕</button>
      </div>
    </header>
  );
}
