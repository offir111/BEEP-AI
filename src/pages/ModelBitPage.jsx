import { useState, useEffect, useCallback, useContext } from 'react';
import AlertChartPanel from '../components/AlertChartPanel';
import RobotNavTabs from '../components/RobotNavTabs';
import LiveQuoteContext, { useQuote, useWsStatus } from '../context/LiveQuoteContext';
import './ModelBitPage.css';

const BOT_URL = 'https://oh-my-god-production.up.railway.app/api/modelbit/status';

function Skeleton({ w = '60%', h = '22px' }) {
  return <div className="mb-skeleton" style={{ width: w, height: h }} />;
}

function fmt(p) {
  if (p == null) return '—';
  return p >= 1000 ? p.toLocaleString('en', { maximumFractionDigits: 0 }) : p.toFixed(2);
}

// Format a USDT/USD volume figure safely — never renders "NaN"/"0.00B" on missing data.
function fmtVolUsd(v) {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function PnlBadge({ val }) {
  const up = val >= 0;
  return (
    <span style={{ color: up ? '#4ade80' : '#ef4444', fontWeight: 700 }}>
      {up ? '+' : ''}{val?.toFixed ? val.toFixed(2) : val}%
    </span>
  );
}

export default function ModelBitPage({ navigate }) {
  // BTC live price — from centralized LiveQuoteContext
  const lqCtx = useContext(LiveQuoteContext);
  const { price: btcPrice, change: btcChange, high: btcHigh, low: btcLow, vol: btcVol, flash } = useQuote('BTC');
  const btc = btcPrice != null ? { price: btcPrice, change: btcChange, high: btcHigh, low: btcLow, vol: btcVol } : null;
  const wsStatus = useWsStatus();
  const btcErr = wsStatus === 'disconnected' && btcPrice == null; // only error before first price
  useEffect(() => {
    if (!lqCtx) return;
    lqCtx.subscribe(['BTC']);
    return () => lqCtx.unsubscribe(['BTC']);
  }, [lqCtx]);

  // Bot data
  const [bot,     setBot]     = useState(null);
  const [botLoad, setBotLoad] = useState(true);
  const [botErr,  setBotErr]  = useState(false);
  const [isDemo,  setIsDemo]  = useState(false);

  // ── Fetch Bot status every 30s ──
  const fetchBot = useCallback(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    fetch(BOT_URL, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        clearTimeout(t);
        setBot(d);
        setIsDemo(!!d._demo);
        setBotErr(false);
      })
      .catch(() => {
        clearTimeout(t);
        setBotErr(true);
        setIsDemo(true);
      })
      .finally(() => setBotLoad(false));
  }, []);

  useEffect(() => {
    fetchBot();
    const iv = setInterval(fetchBot, 30000);
    return () => clearInterval(iv);
  }, [fetchBot]);

  const up = btcChange != null ? btcChange >= 0 : true;

  return (
    <div className="mb-wrap">

      <RobotNavTabs currentPage="model-bit" navigate={navigate} />

      {/* Header */}
      <div className="mb-header">
        <div>
          <h2 className="mb-title">₿ Model BIT — Bitcoin Only</h2>
          <p className="mb-sub">מגמת 4H + כניסה 1H — ניתוח מולטי-טיימפריים</p>
        </div>
        <div className={`mb-status ${!botErr ? 'mb-status--live' : ''}`}>
          <span className={`mb-dot ${!botErr ? 'mb-dot--live' : ''}`} />
          {botErr ? 'OFFLINE' : isDemo ? 'DEMO' : 'LIVE'}
        </div>
      </div>

      {/* Circuit breaker */}
      {bot?.portfolio?.circuit_breaker && (
        <div className="mb-circuit-banner">🚨 CIRCUIT BREAKER פעיל — מסחר מושהה</div>
      )}

      {/* BTC price card */}
      <div className={`mb-price-card${flash === 'up' ? ' mb-flash-up' : flash === 'down' ? ' mb-flash-down' : ''}`}>
        <div className="mb-price-card-top">
          <div className="mb-btc-icon">₿</div>
          <div>
            <div className="mb-btc-label">Bitcoin / USDT</div>
            <div className="mb-btc-sub">
              {wsStatus === 'live'
                ? '🟢 Binance WebSocket — עדכון בזמן אמת'
                : wsStatus === 'disconnected'
                ? '🔴 מנותק — מתחבר מחדש…'
                : '🟡 Binance WebSocket — מתחבר…'}
            </div>
          </div>
        </div>
        {!btc && !btcErr ? <Skeleton w="55%" h="48px" /> :
         btcErr ? <div className="mb-err">⚠ מתחבר...</div> : (
          <>
            <div className={`mb-big-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>${fmt(btcPrice)}</div>
            <div className="mb-change-row">
              <span className={`mb-change-24${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>
                {up ? '▲' : '▼'} {Math.abs(btc.change).toFixed(2)}% — 24H
              </span>
            </div>
            <div className="mb-stats-row">
              <div className="mb-stat"><span className="mb-stat-label">24H גבוה</span><span className="mb-stat-val mb-stat-green">${fmt(btc.high)}</span></div>
              <div className="mb-stat"><span className="mb-stat-label">24H נמוך</span><span className="mb-stat-val mb-stat-red">${fmt(btc.low)}</span></div>
              <div className="mb-stat"><span className="mb-stat-label">Vol (USDT)</span><span className="mb-stat-val">{fmtVolUsd(btc.vol)}</span></div>
            </div>
          </>
        )}
      </div>

      {/* Algo params */}
      <div className="mb-algo-bar">
        <span className="mb-algo-item"><span className="mb-algo-label">Stop</span><span className="mb-algo-val mb-red">1.5%</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Target</span><span className="mb-algo-val mb-green">4%</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Trade</span><span className="mb-algo-val mb-blue">$200</span></span>
        <span className="mb-algo-sep" />
        <span className="mb-algo-item"><span className="mb-algo-label">Hold Max</span><span className="mb-algo-val">12H</span></span>
      </div>

      {/* ── Bot Portfolio (LIVE) ── */}
      {botLoad ? (
        <div className="mb-section"><Skeleton w="100%" h="80px" /></div>
      ) : bot && !botErr ? (
        <>
          {/* Portfolio summary */}
          <div className="mb-section">
            <div className="mb-section-title">
              💼 פורטפוליו — {isDemo ? '🔵 DEMO' : '🟢 LIVE'}
            </div>
            <div className="mb-portfolio-grid">
              <div className="mb-port-card">
                <div className="mb-port-label">יתרה פנויה</div>
                <div className="mb-port-val">${bot.portfolio?.available?.toFixed(0) ?? '—'}</div>
              </div>
              <div className="mb-port-card">
                <div className="mb-port-label">בעסקאות</div>
                <div className="mb-port-val">${bot.portfolio?.in_trades?.toFixed(0) ?? '—'}</div>
              </div>
              <div className="mb-port-card">
                <div className="mb-port-label">P&amp;L כולל</div>
                <div className="mb-port-val" style={{ color: (bot.portfolio?.pnl||0)>=0?'#4ade80':'#ef4444' }}>
                  {bot.portfolio?.pnl >= 0 ? '+' : ''}{bot.portfolio?.pnl?.toFixed(1) ?? '—'}%
                </div>
              </div>
              <div className="mb-port-card">
                <div className="mb-port-label">Win Rate</div>
                <div className="mb-port-val" style={{ color:'#D4AF37' }}>
                  {bot.portfolio?.win_rate != null ? `${bot.portfolio.win_rate.toFixed(0)}%` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Open positions */}
          {bot.positions?.length > 0 && (
            <div className="mb-section">
              <div className="mb-section-title">📊 פוזיציות פתוחות ({bot.positions.length})</div>
              <div className="mb-table-wrap">
                <table className="mb-table">
                  <thead>
                    <tr><th>סוג</th><th>כניסה</th><th>נוכחי</th><th>Stop</th><th>יעד</th><th>P&amp;L%</th></tr>
                  </thead>
                  <tbody>
                    {bot.positions.map((pos, i) => (
                      <tr key={i}>
                        <td><span className={pos.type==='LONG'?'mb-type-long':'mb-type-short'}>{pos.type}</span></td>
                        <td>${fmt(pos.entry_price ?? pos.entry)}</td>
                        <td>${fmt(btcPrice ?? pos.current_price)}</td>
                        <td style={{color:'#ef4444'}}>${fmt(pos.stop_loss ?? pos.stop)}</td>
                        <td style={{color:'#4ade80'}}>${fmt(pos.target_price ?? pos.target)}</td>
                        <td><PnlBadge val={pos.pnl_pct ?? pos.pnl} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trade stats */}
          {(bot.history?.length > 0 || bot.portfolio?.total_trades > 0) && (
            <div className="mb-section">
              <div className="mb-section-title">📈 סטטיסטיקת עסקאות</div>
              <div className="mb-stats-mini">
                <span>סה״כ: <b>{bot.portfolio?.total_trades ?? bot.history?.length ?? 0}</b></span>
                <span>ניצחונות: <b style={{color:'#4ade80'}}>{bot.portfolio?.wins ?? '—'}</b></span>
                <span>הפסדים: <b style={{color:'#ef4444'}}>{bot.portfolio?.losses ?? '—'}</b></span>
                <span>Profit Factor: <b style={{color:'#D4AF37'}}>{bot.portfolio?.profit_factor?.toFixed(2) ?? '—'}</b></span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mb-section">
          <div className="mb-demo-banner">🔵 DEMO MODE — שרת הבוט לא זמין כרגע</div>
        </div>
      )}

      {/* TradingView BTC chart */}
      <div className="mb-chart-wrap">
        <div className="mb-chart-title">גרף BTC/USDT — 1H</div>
        <div className="mb-chart-container">
          <AlertChartPanel symbol="BTC" isCrypto defaultTf="1h" />
        </div>
      </div>

    </div>
  );
}
