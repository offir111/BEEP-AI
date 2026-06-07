import { useState } from 'react';
import './LoginScreen.css';

const ADMIN_USER = 'BEEP';
const ADMIN_PIN  = '12345678'; // Change in production

export default function LoginScreen({ onLogin }) {
  const [mode,     setMode]     = useState('login');
  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState('');

  const isAdmin    = username.trim().toUpperCase() === ADMIN_USER;
  const pinLength  = isAdmin ? 8 : 4;

  const handleSubmit = () => {
    setError('');
    const name = username.trim();
    if (!name) { setError('הכנס שם משתמש'); return; }
    if (pin.length < pinLength) { setError(`PIN חייב להיות ${pinLength} ספרות`); return; }

    if (mode === 'register') {
      const users = JSON.parse(localStorage.getItem('beepai_users') || '[]');
      if (users.find(u => u.username.toLowerCase() === name.toLowerCase())) {
        setError('שם משתמש תפוס'); return;
      }
      users.push({ username: name, pin, isAdmin: false, createdAt: Date.now() });
      localStorage.setItem('beepai_users', JSON.stringify(users));
      onLogin({ username: name, isAdmin: false });
      return;
    }

    // Login
    if (isAdmin && pin === ADMIN_PIN) {
      onLogin({ username: name, isAdmin: true }); return;
    }
    const users = JSON.parse(localStorage.getItem('beepai_users') || '[]');
    const user  = users.find(u => u.username.toLowerCase() === name.toLowerCase() && u.pin === pin);
    if (user) { onLogin({ username: user.username, isAdmin: false }); return; }
    setError('שם משתמש או PIN שגויים');
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
          <div className="login-feature">🤖 ניתוח AI חכם</div>
          <div className="login-feature">⚡ התראות בזמן אמת</div>
        </div>

        {/* Toggle */}
        <div className="login-toggle">
          <button
            className={`login-tog ${mode === 'login' ? 'login-tog--on' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >כניסה</button>
          <button
            className={`login-tog ${mode === 'register' ? 'login-tog--on' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >הרשמה</button>
        </div>

        {/* Inputs */}
        <div className="login-fields">
          <input
            className="login-input"
            type="text"
            placeholder="שם משתמש"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="off"
          />
          <input
            className="login-input"
            type="password"
            placeholder={`PIN (${pinLength} ספרות)`}
            value={pin}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, pinLength);
              setPin(v);
            }}
            inputMode="numeric"
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" onClick={handleSubmit}>
          {mode === 'login' ? 'כניסה →' : 'הרשמה →'}
        </button>
      </div>
    </div>
  );
}
