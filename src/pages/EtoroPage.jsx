import { useState } from 'react';
import './EtoroPage.css';

const TOP3 = [
  {
    ticker: 'NVDA',
    name: 'Nvidia Corp',
    entry: '$210–$230',
    target: '$275',
    stop: '$195',
    upside: '+23%',
    score: 95,
    icon: '🟢',
    color: '#76b900',
    signal: 'Strong Buy',
    details: 'Nvidia ממשיכה להוביל בתשתיות AI — מרג׳ין גולמי 75%+. Data Center Q1 $22.6B — תחזית $26B.',
  },
  {
    ticker: 'BTC',
    name: 'Bitcoin',
    entry: '$98K–$107K',
    target: '$145K',
    stop: '$89K',
    upside: '+38%',
    score: 88,
    icon: '₿',
    color: '#F7931A',
    signal: 'Buy',
    details: 'ביטקוין בתוך קונסולידציה — ETF inflows שוברים שיאים. Halving סייקל תומך ביעד $145K.',
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc',
    entry: '$160–$175',
    target: '$210',
    stop: '$148',
    upside: '+24%',
    score: 82,
    icon: 'G',
    color: '#4285F4',
    signal: 'Buy',
    details: 'Google Cloud מצמיח 28% YoY. Gemini AI מאיץ — P/E אטרקטיבי יחסית לשוק ה-AI.',
  },
];

const TRADERS = [
  {
    name: 'Amit Kupfer',
    handle: '@amikupfer',
    perf: '+150%',
    period: '2 שנים',
    risk: 4,
    copiers: '5,500',
    flag: '🇮🇱',
    holdings: [
      { sym: 'NVDA',  entry: '$210', target: '$275', stop: '$195' },
      { sym: 'TSLA',  entry: '$220', target: '$320', stop: '$190' },
      { sym: 'AAPL',  entry: '$170', target: '$220', stop: '$155' },
    ],
  },
  {
    name: 'Sergiu Niga',
    handle: '@sergiuvlad',
    perf: '+129%',
    period: '2 שנים',
    risk: 4,
    copiers: '412',
    flag: '🇷🇴',
    holdings: [
      { sym: 'AMZN',  entry: '$180', target: '$230', stop: '$160' },
      { sym: 'MSFT',  entry: '$380', target: '$460', stop: '$345' },
      { sym: 'GOOGL', entry: '$165', target: '$210', stop: '$148' },
    ],
  },
  {
    name: 'Juan Quiroz',
    handle: '@juanquirozL',
    perf: '+128%',
    period: '2 שנים',
    risk: 5,
    copiers: '326',
    flag: '🇨🇱',
    holdings: [
      { sym: 'BTC',  entry: '$98K', target: '$145K', stop: '$89K' },
      { sym: 'ETH',  entry: '$2.4K', target: '$4K',  stop: '$2K'  },
      { sym: 'SOL',  entry: '$140', target: '$230',  stop: '$118' },
    ],
  },
];

function ScoreBar({ score }) {
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#D4AF37' : '#ef4444';
  return (
    <div className="et-score-bar-wrap">
      <div className="et-score-bar-bg">
        <div className="et-score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="et-score-num" style={{ color }}>{score}/100</span>
    </div>
  );
}

function RiskDots({ risk }) {
  return (
    <div className="et-risk-dots">
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className={`et-risk-dot${i < risk ? ' et-risk-dot--filled' : ''}`} />
      ))}
    </div>
  );
}

export default function EtoroPage() {
  const [openTrader, setOpenTrader] = useState(null);

  return (
    <div className="et-wrap">

      {/* Header */}
      <div className="et-header">
        <div>
          <h2 className="et-title">📊 eToro — קופי טריידינג</h2>
          <p className="et-sub">המלצות יומיות + טריידרים מובילים לעקוב</p>
        </div>
        <div className="et-demo-badge" title="נתוני ניתוח — לא מחירים בזמן אמת">
          📊 נתוני אנליזה
        </div>
      </div>

      {/* Top 3 recommendations */}
      <div className="et-section-title">🏆 Top 3 המלצות יומיות</div>
      <div className="et-top3-grid">
        {TOP3.map((r, i) => (
          <div key={r.ticker} className="et-rec-card" style={{ '--rec-color': r.color }}>
            <div className="et-rec-rank">#{i + 1}</div>
            <div className="et-rec-header">
              <div className="et-rec-icon" style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44` }}>
                {r.icon}
              </div>
              <div>
                <div className="et-rec-ticker" style={{ color: r.color }}>{r.ticker}</div>
                <div className="et-rec-name">{r.name}</div>
              </div>
              <span className="et-rec-signal">{r.signal}</span>
            </div>

            <ScoreBar score={r.score} />

            <div className="et-rec-params">
              <div className="et-rec-param">
                <span className="et-param-label">כניסה</span>
                <span className="et-param-val">{r.entry}</span>
              </div>
              <div className="et-rec-param">
                <span className="et-param-label">יעד</span>
                <span className="et-param-val et-green">{r.target}</span>
              </div>
              <div className="et-rec-param">
                <span className="et-param-label">סטופ</span>
                <span className="et-param-val et-red">{r.stop}</span>
              </div>
              <div className="et-rec-param">
                <span className="et-param-label">פוטנציאל</span>
                <span className="et-param-val et-green" style={{ fontSize: '1rem', fontWeight: 800 }}>{r.upside}</span>
              </div>
            </div>

            <p className="et-rec-details">{r.details}</p>
          </div>
        ))}
      </div>

      {/* Traders */}
      <div className="et-section-title">👥 טריידרים מובילים — עוקבים</div>
      <div className="et-traders-grid">
        {TRADERS.map(t => (
          <div key={t.name} className="et-trader-card">
            <div className="et-trader-header">
              <div className="et-trader-avatar">
                {t.name.charAt(0)}
              </div>
              <div className="et-trader-info">
                <div className="et-trader-name">{t.flag} {t.name}</div>
                <div className="et-trader-handle">{t.handle}</div>
              </div>
            </div>

            <div className="et-trader-stats">
              <div className="et-trader-stat">
                <span className="et-ts-label">תשואה</span>
                <span className="et-ts-val et-green">{t.perf}</span>
                <span className="et-ts-sub">{t.period}</span>
              </div>
              <div className="et-trader-stat">
                <span className="et-ts-label">ריסק</span>
                <RiskDots risk={t.risk} />
                <span className="et-ts-sub">{t.risk}/7</span>
              </div>
              <div className="et-trader-stat">
                <span className="et-ts-label">עוקבים</span>
                <span className="et-ts-val">{t.copiers}</span>
              </div>
            </div>

            <div className="et-holdings-title">Top Holdings</div>
            <div className="et-holdings">
              {t.holdings.map(h => (
                <div key={h.sym} className="et-holding-row">
                  <span className="et-holding-sym">{h.sym}</span>
                  <span className="et-holding-val">כניסה {h.entry}</span>
                  <span className="et-holding-val et-green">יעד {h.target}</span>
                  <span className="et-holding-val et-red">סטופ {h.stop}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="et-disclaimer">
        ⚠️ המידע מוצג לצורכי לימוד בלבד — נתוני ניתוח סטטיים, אינם מחירים בזמן אמת ואינם ייעוץ השקעות.
      </div>

    </div>
  );
}
