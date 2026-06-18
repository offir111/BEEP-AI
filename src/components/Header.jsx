import { useState, useEffect, useRef } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './Header.css';

// Quick-nav items for the mobile 3-dot menu (replaces the old bottom bar)
const QUICK_NAV = [
  { id: 'home', icon: '🏠', label: 'בית' },
  { id: 'news', icon: '📰', label: 'חדשות' },
];
const ROBOT_NAV = [
  { id: 'tgm',        label: 'TGM — סורק לידים' },
  { id: 'model-w',    label: 'Model W' },
  { id: 'model-bit',  label: 'Model BIT' },
  { id: 'model-smc',  label: 'Model SMC' },
  { id: 'finviz',     label: 'FINVIZ' },
  { id: 'etoro',      label: 'eToro' },
  { id: 'model-grid', label: 'Model Grid' },
  { id: 'daily',      label: 'Daily AI' },
  { id: 'sot',        label: 'SOT' },
];

function IsraelClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hdr-clock">{time}</span>;
}

export default function Header({ username, onLogout, navigate, page }) {
  const { activeCount, unseenFired } = useAlerts();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <header className="hdr">
      {/* Brand — exact BEEP BEEP logo (gold roadrunner + fire); click = home from anywhere */}
      <div className="hdr-brand" onClick={() => navigate('home')} role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('home'); }}
           title="דף הבית">
        <div className="hdr-logo-wrap">
          <img src="/roadrunner-logo.png" className="hdr-logo-img" alt="BEEP AI" />
          <img src="/roadrunner-logo.png" className="hdr-logo-img hdr-logo-fire" aria-hidden="true" alt="" />
        </div>
        <div className="hdr-brand-text">
          <span className="hdr-brand-name">BEEP AI</span>
          <span className="hdr-brand-tagline">scanner stocks &amp; crypto</span>
        </div>
      </div>

      <div className="hdr-center" />

      {/* Right side */}
      <div className="hdr-right">
        <IsraelClock />

        {/* Bell button */}
        <button
          className={`hdr-bell ${page === 'myalerts' ? 'hdr-bell--on' : ''}`}
          onClick={() => navigate('myalerts')}
          title="התראות מחיר"
          aria-label={`התראות מחיר${activeCount > 0 ? ` — ${activeCount} פעילות` : ''}`}
          aria-current={page === 'myalerts' ? 'page' : undefined}
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

        {/* User avatar — opens the user profile page */}
        <button className="hdr-avatar" onClick={() => navigate('profile')} title="הפרופיל שלי" aria-label="הפרופיל שלי">
          {username?.[0]?.toUpperCase()}
        </button>

        <button className="hdr-logout" onClick={onLogout} title="התנתק" aria-label="התנתק מהמערכת">✕</button>

        {/* 3-dot quick menu (mobile nav — replaces the bottom bar) · left of the X */}
        <div className="hdr-menu-wrap" ref={menuRef}>
          <button
            className="hdr-menu-btn"
            onClick={() => setMenuOpen(v => !v)}
            title="תפריט"
            aria-label="תפריט ניווט"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >⋮</button>

          {menuOpen && (
            <div className="hdr-menu-dropdown" role="menu">
              {QUICK_NAV.map(it => (
                <button
                  key={it.id}
                  className={`hdr-menu-item${page === it.id ? ' --on' : ''}`}
                  onClick={() => { navigate(it.id); setMenuOpen(false); }}
                  role="menuitem"
                >
                  <span aria-hidden="true">{it.icon}</span><span>{it.label}</span>
                </button>
              ))}
              <div className="hdr-menu-sep">רובוטים</div>
              {ROBOT_NAV.map(it => (
                <button
                  key={it.id}
                  className={`hdr-menu-item${page === it.id ? ' --on' : ''}`}
                  onClick={() => { navigate(it.id); setMenuOpen(false); }}
                  role="menuitem"
                >
                  <span aria-hidden="true">🤖</span><span>{it.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
