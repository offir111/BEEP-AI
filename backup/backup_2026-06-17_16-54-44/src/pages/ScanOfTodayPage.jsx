import { useState, useEffect, useCallback } from 'react';
import RobotNavTabs from '../components/RobotNavTabs';
import ScannerWidget  from '../components/ScannerWidget';

// ============================================================
//  S.O.T — Scan Of Today
//  Default view: ScannerWidget (animation → BubbleChart)
//  Secondary tab: AI Diagnostic
// ============================================================

const GRAD     = 'linear-gradient(135deg,#818cf8 0%,#6366f1 45%,#4f46e5 100%)';
const BAR_GRAD = 'linear-gradient(90deg,#22d3ee 0%,#818cf8 60%,#6366f1 100%)';

const STEPS = [
  { key: 'collect',  icon: '🗄️', label: 'איסוף נתוני שוק'  },
  { key: 'analyze',  icon: '⚙️',  label: 'ניתוח אלגוריתמי' },
  { key: 'forecast', icon: '📈', label: 'דוח חיזוי'         },
];
const STEP_LABELS = {
  collect:  'מתחבר למקורות נתונים',
  analyze:  'מושך נרות ונפח מסחר',
  forecast: 'מדרג מניות מובילות',
};
const STEP_PROGRESS = { collect: 25, analyze: 65, forecast: 90 };

const SIG_COLOR = {
  'STRONG BUY': '#22c55e', BUY: '#4ade80', HOLD: '#facc15',
  SELL: '#f87171', 'STRONG SELL': '#ef4444',
};
const SIG_BG = {
  'STRONG BUY': 'rgba(34,197,94,0.15)', BUY: 'rgba(74,222,128,0.12)',
  HOLD: 'rgba(250,204,21,0.12)', SELL: 'rgba(248,113,113,0.12)',
  'STRONG SELL': 'rgba(239,68,68,0.15)',
};

const SOT_CACHE_KEY = 'beepai_sot_cache';
const SOT_CACHE_TTL = 15 * 60 * 1000;

function loadSotCache() {
  try {
    const c = JSON.parse(localStorage.getItem(SOT_CACHE_KEY));
    if (c && Date.now() - c.ts < SOT_CACHE_TTL) return c;
  } catch {}
  return null;
}

// ---------- מסך סריקה מסתובב (AI) ----------
function ScannerScreen({ currentStep, stepDone }) {
  const prog  = currentStep ? STEP_PROGRESS[currentStep] : stepDone.length === 3 ? 100 : 10;
  const label = currentStep ? STEP_LABELS[currentStep] : stepDone.includes('forecast') ? 'מסיים...' : 'מתחיל...';
  return (
    <div style={{
      marginTop: 12, padding: '28px 22px 30px', borderRadius: 26,
      background: 'rgba(20,10,38,0.55)', border: '1px solid rgba(168,85,247,.3)',
      boxShadow: '0 0 60px rgba(168,85,247,.18)', position: 'relative', overflow: 'hidden',
      animation: 'sot-rise .35s ease',
    }}>
      <h2 style={{
        textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '0 0 8px',
        background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>סריקת AI מתבצעת</h2>
      <div style={{ display: 'grid', placeItems: 'center', height: 220, position: 'relative' }}>
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="sotRingA" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="sotRingB" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '100px 100px', animation: 'sot-spinCW 3.2s linear infinite' }}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="url(#sotRingA)" strokeWidth="3" strokeLinecap="round" strokeDasharray="160 395" />
            </g>
            <g style={{ transformOrigin: '100px 100px', animation: 'sot-spinCCW 2.4s linear infinite' }}>
              <circle cx="100" cy="100" r="67" fill="none" stroke="url(#sotRingB)" strokeWidth="3" strokeLinecap="round" strokeDasharray="110 315" />
            </g>
            <g style={{ transformOrigin: '100px 100px', animation: 'sot-spinCW 1.8s linear infinite' }}>
              <circle cx="100" cy="100" r="48" fill="none" stroke="rgba(192,132,252,.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="55 250" />
            </g>
          </svg>
          <div style={{
            position: 'absolute', inset: 0, margin: 'auto', width: 72, height: 72, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%,#e9d5ff,#c084fc 38%,#a855f7 70%)',
            boxShadow: '0 0 36px 8px rgba(168,85,247,.65)', animation: 'sot-orb 2s ease-in-out infinite',
          }} />
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${prog}%`, background: BAR_GRAD, transition: 'width .4s ease', boxShadow: '0 0 12px rgba(168,85,247,.6)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ color: '#a78bbf', fontSize: 14 }}>…{label}</span>
        <span style={{ color: '#22d3ee', fontWeight: 800, fontSize: 17 }}>{prog}%</span>
      </div>
    </div>
  );
}

// ---------- כרטיס מניה ----------
function StockCard({ item, rank }) {
  const sigColor = SIG_COLOR[item.signal] || '#facc15';
  const sigBg    = SIG_BG[item.signal]    || 'rgba(250,204,21,0.12)';
  const up = (item.change || 0) >= 0;
  return (
    <div style={{
      marginBottom: 10, padding: 16, borderRadius: 18,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(168,85,247,.28)',
      position: 'relative', overflow: 'hidden', animation: 'sot-rise .35s ease',
    }}>
      <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: GRAD }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(168,85,247,.2)', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 13, color: '#d8b4fe' }}>{rank}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{item.symbol} {item.type === 'crypto' ? '₿' : ''}</div>
            <div style={{ fontSize: 12, color: '#9b8bb4' }}>{item.name}</div>
          </div>
        </div>
        <span style={{ padding: '5px 12px', borderRadius: 999, fontWeight: 800, fontSize: 13, color: sigColor, background: sigBg, border: `1px solid ${sigColor}55` }}>{item.signal}</span>
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
        <Mini label="מחיר"  value={`$${(item.price || 0).toLocaleString()}`} />
        <Mini label="שינוי" value={`${up ? '+' : ''}${item.change || 0}%`} color={up ? '#34d399' : '#f87171'} />
        <Mini label="ציון"  value={item.score} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#c4b5d4', marginBottom: 4 }}>
          <span>ציון AI</span><span>{item.score}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${item.score}%`, background: GRAD, transition: 'width .6s ease' }} />
        </div>
      </div>
    </div>
  );
}
function Mini({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9b8bb4' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

// ============================================================
//  רכיב ראשי
// ============================================================
export default function ScanOfTodayPage({ navigate }) {
  // sotView: 'scanner' (default — ScannerWidget) | 'ai' (AI Diagnostic)
  const [sotView, setSotView] = useState('scanner');

  const cached = loadSotCache();
  const [customSym,   setCustomSym]   = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [stepDone,    setStepDone]    = useState(cached ? ['collect','analyze','forecast'] : []);
  const [currentStep, setCurrentStep] = useState(null);
  const [results,     setResults]     = useState(cached?.results || null);
  const [top3,        setTop3]        = useState(cached?.top3    || null);
  const [aiText,      setAiText]      = useState(cached?.aiText  || '');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [lastScan,    setLastScan]    = useState(cached?.lastScan || '');

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setStepDone([]); setResults(null); setTop3(null);
    setAiText(''); setError('');
    const param = customSym.trim() ? `?symbol=${encodeURIComponent(customSym.trim())}` : '';
    try {
      setCurrentStep('collect'); await delay(700); setStepDone(['collect']);
      setCurrentStep('analyze');
      const resp = await fetch(`/api/scan${param}`);
      if (!resp.ok) throw new Error('שגיאת שרת');
      const data = await resp.json();
      setStepDone(['collect', 'analyze']);
      setCurrentStep('forecast'); await delay(600);
      setStepDone(['collect', 'analyze', 'forecast']); setCurrentStep(null);
      const scanTime = new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
      setResults(data.results); setTop3(data.top3); setLastScan(scanTime);
      setAiLoading(true);
      let aiSummary = '';
      try {
        const aiResp = await fetch('/api/ai-diagnostic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ top3: data.top3 }) });
        const aiData = await aiResp.json();
        aiSummary = aiData.summary || '';
        setAiText(aiSummary);
      } catch { setAiText(''); }
      setAiLoading(false);
      try { localStorage.setItem(SOT_CACHE_KEY, JSON.stringify({ ts: Date.now(), results: data.results, top3: data.top3, aiText: aiSummary, lastScan: scanTime })); } catch {}
    } catch (e) { setError(e.message || 'שגיאה בסריקה'); setCurrentStep(null); }
    setScanning(false);
  }, [scanning, customSym]);

  useEffect(() => { if (sotView === 'ai' && !loadSotCache()) runScan(); }, [sotView]); // eslint-disable-line

  const IconBolt = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>
  );

  return (
    <div dir="rtl" style={{
      position: 'relative', minHeight: '100%',
      fontFamily: "system-ui,-apple-system,'Segoe UI',Arial,sans-serif",
    }}>
      <style>{`
        @keyframes sot-spinCW  {to{transform:rotate(360deg)}}
        @keyframes sot-spinCCW {to{transform:rotate(-360deg)}}
        @keyframes sot-orb    {0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes sot-pulse  {0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes sot-rise   {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion: reduce){*{animation:none!important}}
        .sot-vtabs{display:flex;gap:0;border-radius:12px;overflow:hidden;border:1px solid rgba(168,85,247,.28);margin:10px 0 12px;direction:ltr}
        .sot-vtab{flex:1;padding:10px 6px;background:transparent;border:none;color:rgba(255,255,255,.42);font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
        .sot-vtab+.sot-vtab{border-right:1px solid rgba(168,85,247,.2)}
        .sot-vtab--on{background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(168,85,247,.22));color:#d8b4fe;cursor:default}
        .sot-vtab:not(.sot-vtab--on):hover{background:rgba(168,85,247,.08);color:rgba(255,255,255,.7)}
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '0 14px 50px' }}>

        {/* ── טאב-בר רובוטים ── */}
        <RobotNavTabs currentPage="sot" navigate={navigate} />

        {/* ── מיתוג פנימי ── */}
        <div className="sot-vtabs">
          <button
            className={`sot-vtab${sotView === 'scanner' ? ' sot-vtab--on' : ''}`}
            onClick={() => setSotView('scanner')}>
            📊 סורק &amp; בועות
          </button>
          <button
            className={`sot-vtab${sotView === 'ai' ? ' sot-vtab--on' : ''}`}
            onClick={() => setSotView('ai')}>
            🤖 AI אבחון
          </button>
        </div>

        {/* ══ תצוגה: ScannerWidget (ברירת מחדל) ══ */}
        {sotView === 'scanner' && (
          <div style={{ animation: 'sot-rise .25s ease' }}>
            <ScannerWidget onSearch={(sym) => {
              setCustomSym(sym);
              setSotView('ai');
            }} />
          </div>
        )}

        {/* ══ תצוגה: AI Diagnostic ══ */}
        {sotView === 'ai' && (
          <div style={{ animation: 'sot-rise .25s ease' }}>

            {/* שדה חיפוש */}
            <input
              value={customSym}
              onChange={e => setCustomSym(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && runScan()}
              placeholder="הזינו שם חברה או סימול מניה (אופציונלי)"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '14px 16px',
                borderRadius: 14, background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(168,85,247,.3)', color: '#fff',
                fontSize: 14, textAlign: 'right', outline: 'none', marginBottom: 10,
              }}
            />

            {/* כפתור סריקה */}
            <button onClick={runScan} style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              cursor: 'pointer', background: GRAD, color: '#fff', fontSize: 17,
              fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <IconBolt />
              {top3 ? 'סריקה חדשה' : 'התחל סריקת AI'}
            </button>

            {lastScan && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.28)', marginTop: 7 }}>
                ⏱ סריקה אחרונה: {lastScan}
              </div>
            )}

            {error && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            {/* מסך סריקה */}
            {scanning && <ScannerScreen currentStep={currentStep} stepDone={stepDone} />}

            {/* תוצאות */}
            {!scanning && top3 && top3.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 14 }}>
                  🔥 {top3.length} המניות המובילות היום
                </div>
                {top3.map((item, i) => <StockCard key={item.symbol} item={item} rank={i + 1} />)}

                {(aiLoading || aiText) && (
                  <div style={{ padding: 16, borderRadius: 16, marginBottom: 10, background: 'rgba(147,51,234,.08)', border: '1px solid rgba(147,51,234,.25)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#c084fc', marginBottom: 8 }}>🤖 ניתוח AI</div>
                    {aiLoading
                      ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', animation: 'sot-pulse 1.5s infinite' }}>מנתח נתונים...</div>
                      : <pre style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, lineHeight: 1.6, direction: 'rtl', textAlign: 'right' }}>{aiText}</pre>
                    }
                  </div>
                )}

                {results && results.length > 3 && (
                  <details style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <summary style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', cursor: 'pointer', textAlign: 'center', listStyle: 'none' }}>
                      הצג כל {results.length} נכסים ▾
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
                      {results.slice(3).map((item, i) => <StockCard key={item.symbol} item={item} rank={i + 4} />)}
                    </div>
                  </details>
                )}

                <div style={{ textAlign: 'center', fontSize: 11, color: '#8b7aa3', marginTop: 8 }}>
                  ⚠️ לא ייעוץ השקעות
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
