import { useState, useEffect, useCallback } from 'react';
import './ScanOfTodayPage.css';

const STEPS = [
  { key: 'collect',  icon: '🗄️', label: 'איסוף נתוני שוק'    },
  { key: 'analyze',  icon: '⚙️', label: 'ניתוח אלגוריתמי'   },
  { key: 'forecast', icon: '📈', label: 'דוח חיזוי'          },
];

const SIG_COLOR = {
  'STRONG BUY':  '#22c55e',
  'BUY':         '#4ade80',
  'HOLD':        '#facc15',
  'SELL':        '#f87171',
  'STRONG SELL': '#ef4444',
};

const SIG_BG = {
  'STRONG BUY':  'rgba(34,197,94,0.15)',
  'BUY':         'rgba(74,222,128,0.12)',
  'HOLD':        'rgba(250,204,21,0.12)',
  'SELL':        'rgba(248,113,113,0.12)',
  'STRONG SELL': 'rgba(239,68,68,0.15)',
};

function ScoreBar({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#facc15' : '#ef4444';
  return (
    <div className="sot-score-bar-wrap">
      <div className="sot-score-bar-track">
        <div className="sot-score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="sot-score-num" style={{ color }}>{score}</span>
    </div>
  );
}

function StockCard({ item, rank }) {
  const sigColor = SIG_COLOR[item.signal] || '#facc15';
  const sigBg    = SIG_BG[item.signal]    || 'rgba(250,204,21,0.12)';
  const up = item.change >= 0;
  return (
    <div className="sot-stock-card">
      <div className="sot-stock-rank">#{rank}</div>
      <div className="sot-stock-info">
        <div className="sot-stock-top">
          <span className="sot-stock-sym">{item.symbol}</span>
          <span className="sot-stock-name">{item.name}</span>
          <span className="sot-stock-type">{item.type === 'crypto' ? '₿' : '📊'}</span>
        </div>
        <ScoreBar score={item.score} />
        <div className="sot-stock-bottom">
          <span className="sot-stock-price">${item.price?.toLocaleString()}</span>
          <span className="sot-stock-change" style={{ color: up ? '#4ade80' : '#ef4444' }}>
            {up ? '▲' : '▼'} {Math.abs(item.change)}%
          </span>
          <span className="sot-signal" style={{ color: sigColor, background: sigBg }}>
            {item.signal}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ScanOfTodayPage({ navigate }) {
  const [customSym,    setCustomSym]    = useState('');
  const [scanning,     setScanning]     = useState(false);
  const [stepDone,     setStepDone]     = useState([]); // ['collect','analyze','forecast']
  const [currentStep,  setCurrentStep]  = useState(null);
  const [results,      setResults]      = useState(null);
  const [top3,         setTop3]         = useState(null);
  const [aiText,       setAiText]       = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [lastScan,     setLastScan]     = useState('');

  // Run scan
  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setStepDone([]);
    setResults(null);
    setTop3(null);
    setAiText('');
    setError('');

    const param = customSym.trim() ? `?symbol=${encodeURIComponent(customSym.trim())}` : '';

    try {
      // Step 1 — collect
      setCurrentStep('collect');
      await delay(700);
      setStepDone(['collect']);

      // Step 2 — analyze (actual fetch)
      setCurrentStep('analyze');
      const resp = await fetch(`/api/scan${param}`);
      if (!resp.ok) throw new Error('שגיאת שרת');
      const data = await resp.json();
      setStepDone(['collect','analyze']);

      // Step 3 — forecast
      setCurrentStep('forecast');
      await delay(600);
      setStepDone(['collect','analyze','forecast']);
      setCurrentStep(null);

      setResults(data.results);
      setTop3(data.top3);
      setLastScan(new Date().toLocaleTimeString('he-IL', {
        timeZone:'Asia/Jerusalem', hour:'2-digit', minute:'2-digit'
      }));

      // AI Diagnostic
      setAiLoading(true);
      try {
        const aiResp = await fetch('/api/ai-diagnostic', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ top3: data.top3 })
        });
        const aiData = await aiResp.json();
        setAiText(aiData.summary || '');
      } catch { setAiText(''); }
      setAiLoading(false);

    } catch (e) {
      setError(e.message || 'שגיאה בסריקה');
      setCurrentStep(null);
    }
    setScanning(false);
  }, [scanning, customSym]);

  // Auto-run on mount
  useEffect(() => { runScan(); }, []); // eslint-disable-line

  const SOT_TABS = [
    { id:'sot',       label:'SOT',    active:true  },
    { id:'finviz',    label:'FINVIZ', active:false },
    { id:'model-smc', label:'SMC',    active:false },
    { id:'model-w',   label:'GRID',   active:false },
    { id:'model-bit', label:'BIT',    active:false },
  ];

  return (
    <div className="sot-wrap">

      {/* ── Tab bar ── */}
      <div className="sot-tabs">
        {SOT_TABS.map(t => (
          <button
            key={t.id}
            className={`sot-tab ${t.active ? 'sot-tab--on' : ''}`}
            onClick={() => !t.active && navigate(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Robot header ── */}
      <div className="sot-hero">
        <div className="sot-robot">🤖</div>
        <div className={`sot-ai-badge ${scanning ? 'sot-ai-badge--active' : ''}`}>
          <span className="sot-ai-dot" />
          AI Diagnostic
        </div>
      </div>

      {/* ── Title ── */}
      <div className="sot-title-block">
        <h1 className="sot-title">סריקת מניות חכמה</h1>
        <p className="sot-subtitle">Scan of Today — הסריקה היומית שלך</p>
      </div>

      {/* ── Steps ── */}
      <div className="sot-steps">
        {STEPS.map(s => {
          const done    = stepDone.includes(s.key);
          const active  = currentStep === s.key;
          return (
            <div key={s.key} className={`sot-step ${done?'sot-step--done':''} ${active?'sot-step--active':''}`}>
              <div className="sot-step-icon">{done ? '✓' : s.icon}</div>
              <div className="sot-step-label">{s.label}</div>
              {active && <div className="sot-step-spinner" />}
            </div>
          );
        })}
      </div>

      {/* ── Custom symbol input ── */}
      <div className="sot-input-wrap">
        <input
          className="sot-input"
          placeholder="הזינו שם חברה או סימול מניה (אופציונלי)"
          value={customSym}
          onChange={e => setCustomSym(e.target.value.toUpperCase())}
          disabled={scanning}
          dir="rtl"
        />
      </div>

      {/* ── Scan button ── */}
      <button className={`sot-scan-btn ${scanning?'sot-scan-btn--loading':''}`} onClick={runScan} disabled={scanning}>
        {scanning ? '⏳ סורק...' : '🔍 סריקה חדשה'}
      </button>

      {lastScan && !scanning && (
        <div className="sot-last-scan">⏱ סריקה אחרונה: {lastScan}</div>
      )}

      {error && <div className="sot-error">⚠️ {error}</div>}

      {/* ── Top 3 results ── */}
      {top3 && top3.length > 0 && (
        <div className="sot-results">
          <div className="sot-results-title">
            🔥 {top3.length} המניות המובילות היום
          </div>

          {top3.map((item, i) => (
            <StockCard key={item.symbol} item={item} rank={i + 1} />
          ))}

          {/* AI analysis text */}
          {(aiLoading || aiText) && (
            <div className="sot-ai-card">
              <div className="sot-ai-card-title">🤖 ניתוח AI</div>
              {aiLoading
                ? <div className="sot-ai-loading">מנתח נתונים...</div>
                : <pre className="sot-ai-text">{aiText}</pre>
              }
            </div>
          )}

          {/* Full list toggle */}
          {results && results.length > 3 && (
            <details className="sot-full-list">
              <summary>הצג כל {results.length} נכסים ▾</summary>
              <div className="sot-full-list-inner">
                {results.slice(3).map((item, i) => (
                  <StockCard key={item.symbol} item={item} rank={i + 4} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

    </div>
  );
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
