import { useState } from 'react';
import './LoginScreen.css';

const ADMIN_USER = 'BEEP';

export default function LoginScreen({ onLogin }) {
  const [mode,     setMode]     = useState('login');
  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const isAdmin   = username.trim().toUpperCase() === ADMIN_USER;
  const pinLength = isAdmin ? 8 : 4;

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    const name = username.trim();
    if (!name) { setError('הכנס שם משתמש'); setLoading(false); return; }
    if (pin.length < pinLength) { setError(`PIN חייב להיות ${pinLength} ספרות`); setLoading(false); return; }

    // ── Admin login — verified server-side ──
    if (isAdmin) {
      try {
        const r = await fetch('/api/admin-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const d = await r.json();
        if (d.ok) { onLogin({ username: name, isAdmin: true }); return; }
        else { setError('PIN שגוי'); setLoading(false); return; }
      } catch {
        setError('שגיאת שרת — נסה שוב'); setLoading(false); return;
      }
    }

    // ── Regular user ──
    if (mode === 'register') {
      const users = JSON.parse(localStorage.getItem('beepai_users') || '[]');
      if (users.find(u => u.username.toLowerCase() === name.toLowerCase())) {
        setError('שם משתמש תפוס'); setLoading(false); return;
      }
      users.push({ username: name, pin, isAdmin: false, createdAt: Date.now() });
      localStorage.setItem('beepai_users', JSON.stringify(users));
      onLogin({ username: name, isAdmin: false });
      return;
    }

    // Login
    const users = JSON.parse(localStorage.getItem('beepai_users') || '[]');
    const user  = users.find(u => u.username.toLowerCase() === name.toLowerCase() && u.pin === pin);
    if (user) { onLogin({ username: user.username, isAdmin: false }); return; }
    setError('שם משתמש או PIN שגויים');
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="login-wrap">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">⚡</div>
          <h1 className="login-title">BEEP AI</h1>
          <p className="login-sub">Winning Stock Scanner</p>
        </div>

        {/* Tagline */}
        <div className="login-tagline">
          <div className="login-feature">📈 סיגנלים חיים מהשוק</div>
          <div className="login-feature">🤖 ניתוח AI חכם — בקרוב</div>
          <div className="login-feature">⚡ נתונים בזמן אמת</div>
        </div>

        {/* Toggle */}
        <div className="login-toggle">
          <button
            className={`login-tog ${mode === 'login' ? 'login-tog--on' : ''}`}
            onClick={() => { setMode('login'); setError(''); setPin(''); }}
          >כניסה</button>
          <button
            className={`login-tog ${mode === 'register' ? 'login-tog--on' : ''}`}
            onClick={() => { setMode('register'); setError(''); setPin(''); }}
          >הרשמה</button>
        </div>

        {/* Inputs */}
        <div className="login-fields">
          <input
            className="login-input"
            type="text"
            placeholder="שם משתמש"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus
          />
          <input
            className="login-input"
            type="password"
            placeholder={`PIN — ${pinLength} ספרות`}
            value={pin}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, pinLength);
              setPin(v);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            inputMode="numeric"
          />
        </div>

        {/* PIN indicator dots */}
        <div className="login-dots">
          {Array.from({ length: pinLength }).map((_, i) => (
            <div key={i} className={`login-dot ${i < pin.length ? 'login-dot--filled' : ''}`} />
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'כניסה →' : 'הרשמה →'}
        </button>

      </div>
    </div>
  );
}
