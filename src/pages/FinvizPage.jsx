import { useState } from 'react';
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

export default function FinvizPage() {
  const [filter, setFilter]         = useState('הכל');
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const filters = ['הכל', 'Bullish', 'Bearish', 'Neutral'];

  const visible = filter === 'הכל'
    ? PATTERNS
    : PATTERNS.filter(p => p.type === filter);

  const handleScan = () => {
    setScanning(true);
    setScanResult(null);
    setTimeout(() => {
      const count = 2 + Math.floor(Math.random() * 4);
      const picks = [...SCAN_STOCKS].sort(() => Math.random() - 0.5).slice(0, count);
      setScanResult(picks);
      setScanning(false);
    }, 1800);
  };

  return (
    <div className="fv-wrap">

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

      {/* Scan result */}
      {scanResult && (
        <div className="fv-scan-result">
          <span className="fv-scan-found">נמצאו {scanResult.length} תבניות!</span>
          <div className="fv-scan-tickers">
            {scanResult.map(s => (
              <span key={s} className="fv-scan-ticker">{s}</span>
            ))}
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

    </div>
  );
}
