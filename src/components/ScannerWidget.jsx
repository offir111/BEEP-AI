/**
 * ScannerWidget — SOT-style AI scanning animation
 * • Loops forever, stuck at 89% (never reaches 100%)
 * • "לחץ כאן" text centered on glowing ball
 * • Click → inline search form (input + button)
 * • onSearch(symbol) callback when user submits
 */
import { useState, useEffect, useRef } from 'react';
import './ScannerWidget.css';

const BAR_GRAD = 'linear-gradient(90deg,#22d3ee 0%,#818cf8 60%,#6366f1 100%)';
const CLIMB_MS = 9750; // ~10s to climb 0→89, then STOP at 89

const LABELS = [
  'מתחבר למקורות נתונים',
  'מושך נרות ונפח מסחר',
  'מדרג מניות מובילות',
  'מנתח סיגנלים טכניים',
  'סורק שוק עולמי',
];

function useLoopProgress() {
  const [prog, setProg] = useState(5);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / CLIMB_MS, 1);
      const p = Math.max(5, Math.round(t * 89));
      setProg(p);
      if (t < 1) raf = requestAnimationFrame(tick);
      // t === 1 → stays at 89, no more frames; rings keep spinning via CSS
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return prog;
}

export default function ScannerWidget({ onSearch }) {
  const prog     = useLoopProgress();
  const labelIdx = Math.floor((prog / 89) * (LABELS.length - 1));
  const label    = LABELS[Math.min(labelIdx, LABELS.length - 1)];

  const [showSearch, setShowSearch] = useState(false);
  const [input,      setInput]      = useState('');
  const inputRef = useRef(null);

  /* auto-focus when search panel opens */
  useEffect(() => {
    if (showSearch) setTimeout(() => inputRef.current?.focus(), 80);
  }, [showSearch]);

  const handleSearch = () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    onSearch(sym);
    setShowSearch(false);
    setInput('');
  };

  return (
    <div className="sw-wrap">
      <style>{`
        @keyframes sw-spinCW  { to { transform: rotate(360deg);  } }
        @keyframes sw-spinCCW { to { transform: rotate(-360deg); } }
        @keyframes sw-orb     { 0%,100%{transform:scale(1)}50%{transform:scale(1.1)} }
        @keyframes sw-fadein  { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      {!showSearch ? (
        /* ══ ANIMATION MODE ══════════════════════════════════════ */
        <button className="sw-anim-btn" onClick={() => setShowSearch(true)} aria-label="פתח חיפוש מניה">

          <div className="sw-top">
            <span className="sw-title">סריקת AI מתבצעת</span>
          </div>

          {/* Spinning rings + orb */}
          <div className="sw-rings-area">
            <div className="sw-rings-container">
              <svg className="sw-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="swGA" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#a855f7"/>
                  </linearGradient>
                  <linearGradient id="swGB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c084fc"/>
                    <stop offset="100%" stopColor="#7c3aed"/>
                  </linearGradient>
                </defs>
                {/* outer ring CW — 50% slower */}
                <g style={{transformOrigin:'80px 80px', animation:'sw-spinCW 4.8s linear infinite'}}>
                  <circle cx="80" cy="80" r="70" fill="none" stroke="url(#swGA)"
                    strokeWidth="3" strokeLinecap="round" strokeDasharray="128 316"/>
                </g>
                {/* mid ring CCW — 50% slower */}
                <g style={{transformOrigin:'80px 80px', animation:'sw-spinCCW 3.6s linear infinite'}}>
                  <circle cx="80" cy="80" r="54" fill="none" stroke="url(#swGB)"
                    strokeWidth="3" strokeLinecap="round" strokeDasharray="88 252"/>
                </g>
                {/* inner ring CW — 50% slower */}
                <g style={{transformOrigin:'80px 80px', animation:'sw-spinCW 2.7s linear infinite'}}>
                  <circle cx="80" cy="80" r="38" fill="none"
                    stroke="rgba(192,132,252,.5)" strokeWidth="2"
                    strokeLinecap="round" strokeDasharray="44 200"/>
                </g>
              </svg>

              {/* Glowing ball + text */}
              <div className="sw-orb-wrap">
                <div className="sw-orb" style={{animation:'sw-orb 3s ease-in-out infinite'}}/>
                <span className="sw-orb-text">לחץ כאן</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="sw-bar-area">
            <div className="sw-bar-track">
              <div className="sw-bar-fill" style={{width:`${prog}%`, background: BAR_GRAD}}/>
            </div>
            <div className="sw-bar-meta">
              <span className="sw-bar-label">…{label}</span>
              <span className="sw-bar-pct">{prog}%</span>
            </div>
          </div>
        </button>

      ) : (
        /* ══ SEARCH MODE ══════════════════════════════════════════ */
        <div className="sw-search" style={{animation:'sw-fadein .25s ease'}}>
          <div className="sw-search-title">סריקת מניות חכמה</div>
          <p className="sw-search-sub">הסריקה היומית שלך — Scan of Today</p>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="הזינו שם חברה או סימול מניה (אופציונלי)"
            className="sw-search-input"
          />

          <button className="sw-search-btn" onClick={handleSearch}>
            ⚡ סריקה חדשה
          </button>

          <button className="sw-search-cancel" onClick={() => setShowSearch(false)}>
            ← ביטול
          </button>
        </div>
      )}
    </div>
  );
}
