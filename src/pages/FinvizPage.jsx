import { useState, useEffect } from 'react';
import RobotNavTabs from '../components/RobotNavTabs';
import AlertChartPanel from '../components/AlertChartPanel';
import QuickAlert from '../components/QuickAlert';
import { useAlerts } from '../context/AlertsContext';
import './FinvizPage.css';

const PATTERNS = [
  {
    id: 1,
    name: 'Hammer',
    nameHe: 'פטיש',
    type: 'Bullish',
    desc: 'תבנית היפוך שורי — גוף קטן עם פתיל תחתון ארוך מאד. מסמן דחיית ירידות.',
    svg: (
      <svg viewBox="0 0 60 80" className="pat-svg">
        <line x1="30" y1="10" x2="30" y2="25" stroke="#606070" strokeWidth="2" />
        <rect x="22" y="25" width="16" height="10" rx="2" fill="#4ade80" stroke="#4ade80" />
        <line x1="30" y1="35" x2="30" y2="68" stroke="#4ade80" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    id: 2,
    name: 'Doji',
    nameHe: 'דוג׳י',
    type: 'Neutral',
    desc: 'חוסר החלטה — פתיחה וסגירה כמעט זהות. מסמן עצירה במגמה הנוכחית.',
    svg: (
      <svg viewBox="0 0 60 80" className="pat-svg">
        <line x1="30" y1="10" x2="30" y2="34" stroke="#a0a0b0" strokeWidth="2" />
        <rect x="16" y="34" width="28" height="4" rx="1" fill="#D4AF37" stroke="#D4AF37" />
        <line x1="30" y1="38" x2="30" y2="68" stroke="#a0a0b0" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 3,
    name: 'Engulfing Bullish',
    nameHe: 'בליעה עולה',
    type: 'Bullish',
    desc: 'נר ירוק גדול בולע נר אדום קטן. אחד הסיגנלים החזקים לתחתית.',
    svg: (
      <svg viewBox="0 0 60 80" className="pat-svg">
        <rect x="26" y="20" width="12" height="22" rx="2" fill="#ef4444" />
        <rect x="18" y="14" width="16" height="34" rx="2" fill="#4ade80" />
      </svg>
    ),
  },
  {
    id: 4,
    name: 'Morning Star',
    nameHe: 'כוכב בוקר',
    type: 'Bullish',
    desc: 'תבנית 3 נרות: נר אדום, דוג׳י קטן, נר ירוק גדול. היפוך שורי חזק.',
    svg: (
      <svg viewBox="0 0 80 80" className="pat-svg">
        <rect x="4"  y="16" width="16" height="30" rx="2" fill="#ef4444" />
        <rect x="30" y="40" width="10" height="8"  rx="2" fill="#D4AF37" />
        <line x1="35" y1="36" x2="35" y2="40" stroke="#D4AF37" strokeWidth="1.5" />
        <line x1="35" y1="48" x2="35" y2="52" stroke="#D4AF37" strokeWidth="1.5" />
        <rect x="54" y="20" width="16" height="30" rx="2" fill="#4ade80" />
      </svg>
    ),
  },
  {
    id: 5,
    name: 'Double Bottom',
    nameHe: 'תחתית כפולה',
    type: 'Bullish',
    desc: 'שתי נקודות שפל דומות עם עלייה ביניהן. תבנית W קלאסית לשינוי מגמה עולה.',
    svg: (
      <svg viewBox="0 0 80 70" className="pat-svg">
        <polyline points="4,10 20,55 38,28 56,55 76,10" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        <circle cx="20" cy="55" r="4" fill="#4ade80" />
        <circle cx="56" cy="55" r="4" fill="#4ade80" />
      </svg>
    ),
  },
  {
    id: 6,
    name: 'Double Top',
    nameHe: 'פסגה כפולה',
    type: 'Bearish',
    desc: 'שתי פסגות דומות עם ירידה ביניהן. תבנית M קלאסית לשינוי מגמה יורד.',
    svg: (
      <svg viewBox="0 0 80 70" className="pat-svg">
        <polyline points="4,60 20,14 38,42 56,14 76,60" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        <circle cx="20" cy="14" r="4" fill="#ef4444" />
        <circle cx="56" cy="14" r="4" fill="#ef4444" />
      </svg>
    ),
  },
  {
    id: 7,
    name: 'Triangle Ascending',
    nameHe: 'משולש עולה',
    type: 'Bullish',
    desc: 'נמוכים עולים עם התנגדות אופקית. לחץ קנייה גובר — פריצה שורית צפויה.',
    svg: (
      <svg viewBox="0 0 80 70" className="pat-svg">
        <line x1="6" y1="62" x2="74" y2="62" stroke="#4ade80" strokeWidth="2" strokeDasharray="none" />
        <line x1="6" y1="62" x2="74" y2="14" stroke="#4ade80" strokeWidth="2" />
        <polyline points="6,62 18,50 30,55 42,44 54,48 66,40 74,14" stroke="#a0a0b0" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 8,
    name: 'Marubozu White',
    nameHe: 'מרובוזו ירוק',
    type: 'Bullish',
    desc: 'נר ירוק מלא ללא פתילים — פתיחה בשפל, סגירה בשיא. כוח קנייה מלא.',
    svg: (
      <svg viewBox="0 0 60 80" className="pat-svg">
        <rect x="18" y="12" width="22" height="54" rx="2" fill="#4ade80" />
      </svg>
    ),
  },
  {
    id: 9,
    name: 'Inverse H&S',
    nameHe: 'ראש וכתפיים הפוך',
    type: 'Bullish',
    desc: 'שפל עמוק (ראש) עם שני שפלים גבוהים יותר (כתפיים). פריצת קו צוואר = כניסה.',
    svg: (
      <svg viewBox="0 0 100 70" className="pat-svg">
        <polyline points="4,20 18,50 32,32 50,62 68,32 82,50 96,20"
          stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        <line x1="4" y1="28" x2="96" y2="28" stroke="#D4AF37" strokeWidth="1.2" strokeDasharray="4,3" />
        <circle cx="50" cy="62" r="4" fill="#4ade80" />
      </svg>
    ),
  },
];

const SCAN_STOCKS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'BTCUSDT', 'ETHUSDT', 'SPY'];

const TYPE_COLORS = {
  Bullish: { cls: 'pat-bullish', label: 'Bullish' },
  Bearish: { cls: 'pat-bearish', label: 'Bearish' },
  Neutral: { cls: 'pat-neutral', label: 'Neutral' },
};

// ── Heuristic strength label from the 0–100 scan score ──────────────────────
// NOTE: this is a momentum/volume STRENGTH heuristic (not a buy/sell recommendation
// and not an analyst rating). The scan score arrives on a ~40–92 scale.
function tvSignal(score) {
  if (score >= 78) return { label: 'מומנטום חזק',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (score >= 68) return { label: 'מומנטום בינוני', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' };
  if (score >= 58) return { label: 'ניטרלי',        color: '#D4AF37', bg: 'rgba(212,175,55,0.10)' };
  return                 { label: 'חלש',           color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' };
}

// ── Live pattern result section ───────────────────────────────
function LivePatternResult({ data, onSelect, criterion }) {
  if (!data) return null;
  const pats = data.patterns.filter(p => p.stocks.length > 0 && (!criterion || p.id === criterion));
  const shown = pats.reduce((n, p) => n + p.stocks.length, 0);
  return (
    <div className="fv-live-result">
      <div className="fv-live-header">
        <span className="fv-live-title">🎯 {criterion ? shown : data.total} מניות נמצאו — סריקה חיה</span>
        <span className="fv-live-time">{data.scannedAt ? new Date(data.scannedAt).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
      </div>
      {pats.map(pat => pat.stocks.length > 0 && (
        <div key={pat.id} className="fv-live-pat-group">
          <div className="fv-live-pat-title" style={{ color: pat.color }}>
            {pat.emoji} {pat.labelHe} — {pat.stocks.length} מניות ({pat.confidence}% ביטחון)
          </div>
          <div className="fv-live-stocks">
            {pat.stocks.slice(0, 8).map(s => {
              const sig = tvSignal(s.score);
              const up = s.change >= 0;
              return (
                <div
                  key={s.ticker}
                  className="fv-live-stock-row"
                  onClick={() => onSelect(s.ticker, s.price)}
                  style={{ cursor: 'pointer' }}
                  title={`פתח גרף ${s.ticker}`}
                  role="button"
                >
                  <span className="fv-live-ticker">{s.ticker}</span>
                  <span className="fv-live-price">${s.price.toFixed(2)}</span>
                  <span className="fv-live-change" style={{ color: up?'#4ade80':'#ef4444' }}>{up?'▲':'▼'}{Math.abs(s.change)}%</span>
                  {s.rsi != null && <span className="fv-live-rsi">RSI {s.rsi}</span>}
                  <span className="fv-live-cap">{s.mcapFmt}</span>
                  <span className="fv-live-sig" style={{ color:sig.color, background:sig.bg }}>{sig.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="fv-live-source">מקור: Yahoo Finance / Stooq · {data.criteria?.universe} · סיווג היוריסטי לפי תנועת יום (לא זיהוי תבנית נרות)</div>
    </div>
  );
}

// ── Per-stock chart modal — same AlertChartPanel the Gainers page uses ──────────
function FvChartModal({ symbol, price, onClose }) {
  const [showAlert, setShowAlert] = useState(false);
  const { alerts } = useAlerts();
  const pending = alerts.filter(a => !a.triggered && a.symbol === symbol.toUpperCase()).length;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(960px,96vw)', height: 'min(70vh,560px)',
                 background: 'var(--bg-card,#1a1a26)', borderRadius: 14, overflow: 'hidden',
                 border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {!showAlert && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <AlertChartPanel symbol={symbol} isCrypto={false} defaultTf="1D" />
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="סגור גרף"
          style={{ position: 'absolute', top: 10, insetInlineEnd: 10, zIndex: 5, width: 32, height: 32,
                   borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff',
                   fontSize: 16, cursor: 'pointer' }}
        >✕</button>
        {!showAlert && (
          <button
            onClick={() => setShowAlert(true)}
            style={{ position: 'absolute', bottom: 12, insetInlineEnd: 12, zIndex: 5, padding: '8px 14px',
                     borderRadius: 10, border: '1px solid rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.12)',
                     color: '#D4AF37', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🔔 <span>התראה</span>
            {pending > 0 && (
              <span style={{ background: '#D4AF37', color: '#000', borderRadius: 999, padding: '0 6px', fontSize: 12 }}>{pending}</span>
            )}
          </button>
        )}
        {showAlert && (
          <QuickAlert contained symbol={symbol} currentPrice={price} onClose={() => setShowAlert(false)} />
        )}
      </div>
    </div>
  );
}

export default function FinvizPage({ navigate }) {
  const [filter, setFilter]         = useState('הכל');
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [liveData,  setLiveData]    = useState(null);
  const [scanError, setScanError]   = useState('');
  const [detailSym,   setDetailSym]   = useState(null);
  const [detailPrice, setDetailPrice] = useState(null);
  const [criterion,   setCriterion]   = useState(null);   // selected live-search criterion (pattern id)

  const openDetail = (ticker, price = null) => { setDetailSym(ticker); setDetailPrice(price); };

  const filters = ['הכל', 'Bullish', 'Bearish', 'Neutral'];

  const visible = filter === 'הכל'
    ? PATTERNS
    : PATTERNS.filter(p => p.type === filter);

  // Auto-load on mount
  useEffect(() => { handleScan(); }, []); // eslint-disable-line

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    setScanError('');
    try {
      const res = await fetch('/api/finviz-model');
      if (!res.ok) throw new Error(`שגיאת שרת ${res.status}`);
      const data = await res.json();
      setLiveData(data);
      // Collect all tickers for "found" display
      const tickers = data.patterns.flatMap(p => p.stocks.slice(0,4).map(s => s.ticker));
      setScanResult(tickers.length > 0 ? tickers : ['לא נמצאו מניות']);
    } catch (e) {
      setScanError(e.message);
      setScanResult([]);
    }
    setScanning(false);
  };

  return (
    <div className="fv-wrap">

      <RobotNavTabs currentPage="finviz" navigate={navigate} />

      {/* Header */}
      <div className="fv-header">
        <div>
          <h2 className="fv-title">🔍 FINVIZ — תבניות נרות</h2>
          <p className="fv-sub">גלריית תבניות נרות יפניים — זיהוי נקודות היפוך</p>
        </div>
        <button className="fv-scan-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? '⏳ סורק...' : '⚡ סרוק עכשיו'}
        </button>
      </div>

      {/* Criteria buttons — one per live-search criterion; click to see its stocks */}
      {liveData?.patterns?.some(p => p.stocks.length > 0) && (
        <div className="fv-crit-row">
          <button
            className={`fv-crit-btn${!criterion ? ' --on' : ''}`}
            onClick={() => setCriterion(null)}
          >הכל</button>
          {liveData.patterns.filter(p => p.stocks.length > 0).map(p => (
            <button
              key={p.id}
              className={`fv-crit-btn${criterion === p.id ? ' --on' : ''}`}
              style={criterion === p.id ? { borderColor: p.color, color: p.color } : undefined}
              onClick={() => setCriterion(p.id)}
            >
              {p.emoji} {p.labelHe} ({p.stocks.length})
            </button>
          ))}
        </div>
      )}

      {/* Live scan results */}
      <LivePatternResult data={liveData} onSelect={openDetail} criterion={criterion} />

      {/* Scan result chips */}
      {scanResult && scanResult.length > 0 && (
        <div className="fv-scan-result">
          <div className="fv-scan-top">
            <span className="fv-scan-found">✅ LIVE — נמצאו {scanResult.length}+ מניות</span>
            {scanError && <span className="fv-scan-demo-label">⚠️ {scanError}</span>}
          </div>
          <div className="fv-scan-tickers">
            {scanResult.slice(0,12).map(s => {
              const clickable = s !== 'לא נמצאו מניות';
              return (
                <span
                  key={s}
                  className="fv-scan-ticker"
                  onClick={clickable ? () => openDetail(s) : undefined}
                  style={clickable ? { cursor: 'pointer' } : undefined}
                  title={clickable ? `פתח גרף ${s}` : undefined}
                >{s}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter buttons */}
      <div className="fv-filters">
        {filters.map(f => (
          <button
            key={f}
            className={`fv-filter-btn${filter === f ? ' fv-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span className="fv-count">{visible.length} תבניות</span>
      </div>

      {/* Gallery */}
      <div className="fv-gallery">
        {visible.map(p => {
          const tc = TYPE_COLORS[p.type];
          return (
            <div key={p.id} className={`fv-card fv-card--${p.type.toLowerCase()}`}>
              <div className="fv-card-svg-wrap">
                {p.svg}
              </div>
              <div className="fv-card-body">
                <div className="fv-card-top">
                  <div className="fv-card-names">
                    <span className="fv-name-he">{p.nameHe}</span>
                    <span className="fv-name-en">{p.name}</span>
                  </div>
                  <span className={`fv-type-badge ${tc.cls}`}>{tc.label}</span>
                </div>
                <p className="fv-desc">{p.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-stock chart modal (same chart as the Gainers page) */}
      {detailSym && (
        <FvChartModal symbol={detailSym} price={detailPrice} onClose={() => setDetailSym(null)} />
      )}

    </div>
  );
}
