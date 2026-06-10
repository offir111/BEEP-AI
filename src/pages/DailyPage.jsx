import { useState, useEffect } from 'react';
import './DailyPage.css';

const NEWS = [
  {
    rank: 1,
    ticker: 'NVDA',
    score: 94,
    headline: 'Nvidia beats Q4 expectations, announces $50B buyback program',
    headlineHe: 'נבידיה עוקפת ציפיות Q4, מכריזה על רכישה חוזרת של $50B',
    upside: '+23%',
    signals: ['⚡ Strong Buy', '🚀 Breakout'],
    detail: 'Nvidia הכריזה על EPS של $5.16 vs ציפיות $4.64. רווח גולמי 74.6%. Data Center הכניסה $22.6B — שיא כל הזמנים. Buyback של $50B מסמן ביטחון ההנהלה. מניה נסחרת ב-P/E של 35 על תחזיות FY26.',
    tickerColor: '#76b900',
  },
  {
    rank: 2,
    ticker: 'BTC',
    score: 88,
    headline: 'Bitcoin ETF inflows hit record $1.2B in single day',
    headlineHe: 'זרימות ETF ביטקוין שוברות שיא — $1.2B ביום אחד',
    upside: '+15%',
    signals: ['⚡ Strong Buy', '📈 Momentum'],
    detail: 'ביום שישי נרשמו $1.2B זרימות נטו לכלל ה-Spot Bitcoin ETFs — שיא מאז ינואר 2024. BlackRock IBIT בלבד ספג $843M. On-chain: ארנקות ל-4 שנות שפל — ריצה מספרי אספקה לאפוקים.',
    tickerColor: '#F7931A',
  },
  {
    rank: 3,
    ticker: 'GOOGL',
    score: 82,
    headline: 'Alphabet Cloud revenue grows 28% YoY, beats estimates',
    headlineHe: 'Google Cloud צמח 28% שנה-על-שנה — עקף את הציפיות',
    upside: '+18%',
    signals: ['✅ Buy', '☁️ AI Cloud'],
    detail: 'Alphabet הציגה הכנסות Google Cloud של $12.3B — עלייה של 28% YoY. Gemini AI מוטמע ב-4M מפתחים. P/E 22x — זול ביחס לקבוצת FAANG. YouTube Ads $9.4B — שיא.',
    tickerColor: '#4285F4',
  },
  {
    rank: 4,
    ticker: 'TSLA',
    score: 71,
    headline: 'Tesla delivers 495K vehicles in Q4, beats analyst estimate',
    headlineHe: 'טסלה מסרה 495,000 רכבים ב-Q4 — עקפה את הצפי',
    upside: '+12%',
    signals: ['✅ Buy', '🔋 EV Recovery'],
    detail: 'Tesla דיווחה 495,000 משלוחים vs ציפיות 484,000. הכנסות ממכירות $25.7B. מרג׳ין גולמי של 18.2% — עלייה מ-17.4%. Cybertruck: 12,000 יחידות ב-Q4. Optimus: pilot עם 1,000 רובוטים.',
    tickerColor: '#e31937',
  },
  {
    rank: 5,
    ticker: 'META',
    score: 65,
    headline: 'Meta AI users cross 1 billion mark globally',
    headlineHe: 'Meta AI חצתה מיליארד משתמשים פעילים ברחבי העולם',
    upside: '+9%',
    signals: ['➕ Accumulate', '🤖 AI Growth'],
    detail: 'מארק צוקרברג: Meta AI הגיעה ל-1B MAU — מהירות אימוץ חסרת תקדים. Llama 3.1 פתוחה ומוביל בדירוגים. CAPEX 2025 תועדכן ל-$65-72B. הכנסות Reels צמחו 40% YoY.',
    tickerColor: '#0082fb',
  },
];

const MEDALS = ['🥇', '🥈', '🥉', '#4', '#5'];

function ScoreBar({ score }) {
  const color = score >= 80 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-gold)' : '#f97316';
  return (
    <div className="dp-score-bar">
      <div className="dp-score-track">
        <div className="dp-score-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="dp-score-label" style={{ color }}>{score}/100</span>
    </div>
  );
}

function NewsCard({ item, idx }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`dp-card${expanded ? ' dp-card--open' : ''}`} style={{ '--rank-color': item.tickerColor }}>
      <div className="dp-card-main">
        <div className="dp-rank">{MEDALS[idx]}</div>

        <div className="dp-ticker-badge" style={{ background: item.tickerColor + '22', color: item.tickerColor, border: `1px solid ${item.tickerColor}44` }}>
          {item.ticker}
        </div>

        <div className="dp-content">
          <div className="dp-headline">{item.headlineHe}</div>
          <div className="dp-headline-en">{item.headline}</div>
          <ScoreBar score={item.score} />
          <div className="dp-signals">
            {item.signals.map(s => (
              <span key={s} className="dp-signal-chip">{s}</span>
            ))}
            <span className="dp-upside">{item.upside}</span>
          </div>
        </div>

        <button className="dp-expand-btn" onClick={() => setExpanded(e => !e)} title={expanded ? 'סגור' : 'פרטים נוספים'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="dp-detail">
          <p>{item.detail}</p>
        </div>
      )}
    </div>
  );
}

const SIG_LABELS = {
  'STRONG BUY': ['⚡ Strong Buy', '🚀 Momentum'], BUY: ['✅ Buy', '📈 Trend Up'],
  HOLD: ['⏸ Hold', '🔍 Watchlist'], SELL: ['📉 Sell', '⚠️ Caution'], 'STRONG SELL': ['🔴 Strong Sell', '⛔ Exit'],
};
const COLORS = ['#76b900','#F7931A','#4285F4','#e31937','#0082fb','#9945FF','#F3BA2F','#627EEA'];

export default function DailyPage() {
  const [items,    setItems]    = useState(NEWS); // start with static, replace with live
  const [loading,  setLoading]  = useState(true);
  const [lastScan, setLastScan] = useState('');

  useEffect(() => {
    fetch('/api/scan')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        const top = (data.results || []).slice(0, 5);
        if (top.length === 0) { setLoading(false); return; }
        const live = top.map((item, i) => ({
          rank:       i + 1,
          ticker:     item.symbol,
          score:      item.score,
          headline:   `${item.name} — ${item.signal} (${item.change > 0 ? '+' : ''}${item.change}%)`,
          headlineHe: `${item.name}: ${item.signal} | שינוי ${item.change > 0 ? '+' : ''}${item.change}% | מחיר $${item.price?.toLocaleString()}`,
          upside:     item.change > 0 ? `+${item.change}%` : `${item.change}%`,
          signals:    SIG_LABELS[item.signal] || ['📊 סריקה'],
          detail:     `ניתוח חי — ${item.name} (${item.symbol}) | ציון: ${item.score}/100 | מחיר: $${item.price?.toLocaleString()} | שינוי 24H: ${item.change > 0 ? '+' : ''}${item.change}% | סיגנל: ${item.signal}`,
          tickerColor: COLORS[i % COLORS.length],
        }));
        setItems(live);
        setLastScan(new Date().toLocaleTimeString('he-IL', { timeZone:'Asia/Jerusalem', hour:'2-digit', minute:'2-digit' }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="dp-wrap">

      {/* Header */}
      <div className="dp-header">
        <div>
          <h2 className="dp-title">🤖 Daily AI — חדשות מדורגות</h2>
          <p className="dp-sub">חדשות מדורגות על ידי AI לפי פוטנציאל מסחרי</p>
        </div>
        <div className="dp-curated-badge">
          📌 ניתוח אצור
        </div>
      </div>

      {/* Status banner */}
      {loading ? (
        <div className="dp-demo-banner">⏳ טוען נתונים חיים...</div>
      ) : lastScan ? (
        <div className="dp-live-banner">🟢 LIVE — נתונים חיים · עדכון: {lastScan} · לא ייעוץ השקעות</div>
      ) : (
        <div className="dp-demo-banner">🤖 DEMO — נתונים לדוגמה בלבד — לא ייעוץ השקעות</div>
      )}

      {/* Rank legend */}
      <div className="dp-legend-row">
        <span className="dp-legend-item dp-legend-green">● ≥ 80 חזק</span>
        <span className="dp-legend-item dp-legend-yellow">● ≥ 50 בינוני</span>
        <span className="dp-legend-item dp-legend-orange">● &lt; 50 חלש</span>
      </div>

      {/* Cards */}
      <div className="dp-cards">
        {items.map((item, i) => (
          <NewsCard key={item.ticker} item={item} idx={i} />
        ))}
      </div>

    </div>
  );
}
