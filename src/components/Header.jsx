import { useState, useEffect } from 'react';
import './Header.css';

function IsraelClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hdr-clock">{time}</span>;
}

export default function Header({ username, onLogout, navigate, page }) {
  return (
    <header className="hdr">
      <div className="hdr-brand" onClick={() => navigate('home')}>
        <span className="hdr-icon">⚡</span>
        <div>
          <span className="hdr-title">BEEP AI</span>
          <span className="hdr-sub">Stock Scanner</span>
        </div>
      </div>

      <div className="hdr-center">
        {/* Future: live price strip here */}
      </div>

      <div className="hdr-right">
        <IsraelClock />
        <div className="hdr-user" title={username}>
          <span className="hdr-avatar">{username?.[0]?.toUpperCase()}</span>
          <span className="hdr-username">{username}</span>
        </div>
        <button className="hdr-logout" onClick={onLogout} title="התנתק">✕</button>
      </div>
    </header>
  );
}
