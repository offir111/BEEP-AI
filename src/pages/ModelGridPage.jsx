/**
 * ModelGridPage.jsx
 *
 * Grid bot dashboard — מבנה זהה ל-ModelBitPage.
 * נתונים מ-GitHub (portfolio.json + grid_state.json).
 * BTC live מ-LiveQuoteContext (WebSocket).
 */
import { useState, useEffect, useCallback, useContext } from 'react';
import AlertChartPanel from '../components/AlertChartPanel';
import RobotNavTabs from '../components/RobotNavTabs';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import './ModelGridPage.css';

const PORTFOLIO_URL  = 'https://raw.githubusercontent.com/offir111/model-grid/master/data/portfolio.json';
const GRID_STATE_URL = 'https://raw.githubusercontent.com/offir111/model-grid/master/data/grid_state.json';

function Skeleton({ w = '60%', h = '22px' }) {
  return <div className="mg-skeleton" style={{ width: w, height: h }} />;
}

function fmt(p, decimals = 2) {
  if (p == null || isNaN(p)) return '—';
  return p >= 10000
    ? p.toLocaleString('en', { maximumFractionDigits: 0 })
    : p >= 1
    ? p.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : p.toFixed(4);
}

function pct(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

/** Draw a mini progress bar showing how many grid levels are filled */
function GridBar({ levels = [] }) {
  if (!levels.length) return null;
  const filled  = levels.filter(l => l.filled).length;
  const total   = levels.length;
  const fillPct = Math.round((filled / total) * 100);
  return (
    <div className="mg-grid-bar-wrap">
      <div className="mg-grid-bar-track">
        <div className="mg-grid-bar-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <span className="mg-grid-bar-label">{filled}/{total} רמות מלאות ({fillPct}%)</span>
    </div>
  );
}

export default function ModelGridPage({ navigate }) {
  // BTC live price — from centralized LiveQuoteContext
  const lqCtx = useContext(LiveQuoteContext);
  const { price: btcPrice, change: btcChange, high: btcHigh, low: btcLow, flash } = useQuote('BTC');
  const btc = btcPrice != null ? { price: btcPrice, change: btcChange, high: btcHigh, low: btcLow, vol: null } : null;
  const btcErr = false;
  useEffect(() => {
    if (!lqCtx) return;
    lqCtx.subscribe(['BTC']);
    return () => lqCtx.unsubscribe(['BTC']);
  }, [lqCtx]);

  // Portfolio data
  const [port,    setPort]    = useState(null);
  const [portErr, setPortErr] = useState(false);
  const [portLoad,setPortLoad]= useState(true);

  // Grid state
  const [grid,    setGrid]    = useState(null);
  const [gridErr, setGridErr] = useState(false);

  // Tab: overview | levels | trades
  const [tab, setTab] = useState('overview');

  // ── Portfolio & grid state ──────────────────────────────────
  const fetchData = useCallback(() => {
    setPortLoad(true);
    Promise.all([
      fetch(PORTFOLIO_URL,  { cache: 'no-store' }).then(r => r.json()),
      fetch(GRID_STATE_URL, { cache: 'no-store' }).then(r => r.json()),
    ])
      .then(([p, g]) => {
        setPort(p);
        setGrid(g);
        setPortErr(false);
        setGridErr(false);
      })
      .catch(() => {
        setPortErr(true);
        setGridErr(true);
      })
      .finally(() => setPortLoad(false));
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60000); // refresh every 60s
    return () => clearInterval(iv);
  }, [fetchData]);

  const up    = btcChange != null ? btcChange >= 0 : true;
  const pnl   = port?.realized_pnl ?? 0;
  const apr   = port?.apr ?? 0;
  const inRng = grid && btcPrice != null ? btcPrice >= grid.lower && btcPrice <= grid.upper : null;

  // Filter log
  const trades = (port?.trade_log ?? []).slice(-30).reverse();

  return (
    <div className="mg-wrap">

      <RobotNavTabs currentPage="model-grid" navigate={navigate} />

      {/* ── Header ── */}
      <div className="mg-header">
        <div>
          <h2 className="mg-title">📐 Model GRID — Bitcoin Grid Bot</h2>
          <p className="mg-sub">אסטרטגיית גריד — קניה ומכירה אוטומטית ברמות מחיר</p>
        </div>
        <div className={`mg-status ${!portErr ? 'mg-status--live' : ''}`}>
          <span className={`mg-dot ${!portErr ? 'mg-dot--live' : ''}`} />
          {portErr ? 'OFFLINE' : 'LIVE'}
        </div>
      </div>

      {/* ── BTC price card ── */}
      <div className={`mg-price-card${flash === 'up' ? ' mg-flash-up' : flash === 'down' ? ' mg-flash-down' : ''}`}>
        <div className="mg-price-card-top">
          <div className="mg-btc-icon">₿</div>
          <div>
            <div className="mg-btc-label">Bitcoin / USDT</div>
            <div className="mg-btc-sub">Binance WebSocket — עדכון בזמן אמת</div>
          </div>
          {inRng !== null && (
            <span className={`mg-range-badge ${inRng ? 'mg-range-badge--in' : 'mg-range-badge--out'}`}>
              {inRng ? '✓ בטווח הגריד' : '⚠ מחוץ לטווח'}
            </span>
          )}
        </div>

        {!btc && !btcErr
          ? <Skeleton w="55%" h="48px" />
          : btcErr
          ? <div className="mg-err">⚠ מתחבר...</div>
          : (
            <>
              <div className={`mg-big-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>${fmt(btcPrice, 0)}</div>
              <div className="mg-change-row">
                <span className={`mg-change-24${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>
                  {up ? '▲' : '▼'} {Math.abs(btc.change).toFixed(2)}% — 24H
                </span>
              </div>
              <div className="mg-stats-row">
                <div className="mg-stat"><span className="mg-stat-label">24H גבוה</span><span className="mg-stat-val mg-green">${fmt(btc.high, 0)}</span></div>
                <div className="mg-stat"><span className="mg-stat-label">24H נמוך</span><span className="mg-stat-val mg-red">${fmt(btc.low, 0)}</span></div>
                <div className="mg-stat"><span className="mg-stat-label">Vol</span><span className="mg-stat-val">${(btc.vol / 1e9).toFixed(2)}B</span></div>
              </div>
            </>
          )
        }
      </div>

      {/* ── Grid params bar ── */}
      <div className="mg-params-bar">
        <span className="mg-param"><span className="mg-param-label">תחתון</span><span className="mg-param-val">${grid ? fmt(grid.lower, 0) : '…'}</span></span>
        <span className="mg-param-sep" />
        <span className="mg-param"><span className="mg-param-label">עליון</span><span className="mg-param-val">${grid ? fmt(grid.upper, 0) : '…'}</span></span>
        <span className="mg-param-sep" />
        <span className="mg-param"><span className="mg-param-label">רמות</span><span className="mg-param-val mg-gold">{grid?.grids ?? '…'}</span></span>
        <span className="mg-param-sep" />
        <span className="mg-param"><span className="mg-param-label">ATR 14</span><span className="mg-param-val">{grid ? fmt(grid.atr14, 0) : '…'}</span></span>
        <span className="mg-param-sep" />
        <span className="mg-param"><span className="mg-param-label">APR</span><span className="mg-param-val" style={{ color: apr >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pct(apr)}</span></span>
      </div>

      {/* ── KPI cards ── */}
      {portLoad
        ? <div className="mg-section"><Skeleton w="100%" h="70px" /></div>
        : portErr
        ? (
          <div className="mg-section">
            <div className="mg-demo-banner">⚠ לא ניתן לטעון נתוני בוט — בדוק חיבור</div>
          </div>
        )
        : port && (
          <div className="mg-kpi-grid">
            <div className="mg-kpi">
              <div className="mg-kpi-label">השקעה</div>
              <div className="mg-kpi-val">${fmt(port.investment, 0)}</div>
            </div>
            <div className="mg-kpi">
              <div className="mg-kpi-label">רווח ממומש</div>
              <div className="mg-kpi-val" style={{ color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                ${fmt(pnl)}
              </div>
            </div>
            <div className="mg-kpi">
              <div className="mg-kpi-label">מחזורים</div>
              <div className="mg-kpi-val mg-gold">{port.total_cycles ?? '—'}</div>
            </div>
            <div className="mg-kpi">
              <div className="mg-kpi-label">Max DD</div>
              <div className="mg-kpi-val mg-red">{port.max_drawdown != null ? pct(port.max_drawdown) : '—'}</div>
            </div>
          </div>
        )
      }

      {/* ── Tabs ── */}
      {!portLoad && !portErr && (
        <div className="mg-section">
          <div className="mg-tabs">
            {['overview', 'levels', 'trades'].map(t => (
              <button
                key={t}
                className={`mg-tab${tab === t ? ' mg-tab--on' : ''}`}
                onClick={() => setTab(t)}
              >
                {{ overview: '📊 סקירה', levels: '📈 רמות', trades: '📋 עסקאות' }[t]}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'overview' && grid && (
            <div className="mg-tab-body">
              <GridBar levels={grid.grid ?? []} />
              <div className="mg-overview-grid">
                <div className="mg-ov-row">
                  <span className="mg-ov-label">טווח גריד</span>
                  <span className="mg-ov-val">${fmt(grid.lower, 0)} — ${fmt(grid.upper, 0)}</span>
                </div>
                <div className="mg-ov-row">
                  <span className="mg-ov-label">רמות גריד</span>
                  <span className="mg-ov-val mg-gold">{grid.grids}</span>
                </div>
                <div className="mg-ov-row">
                  <span className="mg-ov-label">רמות מלאות</span>
                  <span className="mg-ov-val mg-green">{(grid.grid ?? []).filter(l => l.filled).length}</span>
                </div>
                <div className="mg-ov-row">
                  <span className="mg-ov-label">ממתינות</span>
                  <span className="mg-ov-val">{(grid.grid ?? []).filter(l => !l.filled).length}</span>
                </div>
                {port?.last_updated && (
                  <div className="mg-ov-row">
                    <span className="mg-ov-label">עדכון אחרון</span>
                    <span className="mg-ov-val mg-muted">{new Date(port.last_updated).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Levels tab */}
          {tab === 'levels' && grid?.grid?.length > 0 && (
            <div className="mg-tab-body mg-levels-body">
              <div className="mg-table-wrap">
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>קנייה</th>
                      <th>מכירה</th>
                      <th>כמות</th>
                      <th>רווח</th>
                      <th>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...grid.grid].reverse().map((lvl, i) => {
                      const isCurrent = btcPrice != null && btcPrice >= lvl.buy && btcPrice <= lvl.sell;
                      return (
                        <tr key={i} className={isCurrent ? 'mg-row-current' : ''}>
                          <td className="mg-muted">{grid.grid.length - i}</td>
                          <td className="mg-blue">${fmt(lvl.buy, 0)}</td>
                          <td className="mg-gold">${fmt(lvl.sell, 0)}</td>
                          <td>{lvl.qty != null ? lvl.qty.toFixed(5) : '—'}</td>
                          <td className={lvl.profit > 0 ? 'mg-green' : 'mg-muted'}>${fmt(lvl.profit)}</td>
                          <td>
                            <span className={`mg-level-badge ${lvl.filled ? 'mg-level-filled' : 'mg-level-wait'}`}>
                              {lvl.filled ? '✓ מלאה' : '○ ממתין'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trades tab */}
          {tab === 'trades' && (
            <div className="mg-tab-body">
              {trades.length === 0
                ? <div className="mg-empty">אין היסטוריית עסקאות עדיין</div>
                : (
                  <div className="mg-table-wrap">
                    <table className="mg-table">
                      <thead>
                        <tr>
                          <th>סוג</th>
                          <th>מחיר</th>
                          <th>כמות</th>
                          <th>רווח</th>
                          <th>זמן</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t, i) => (
                          <tr key={i}>
                            <td>
                              <span className={t.type === 'BUY' ? 'mg-type-buy' : 'mg-type-sell'}>
                                {t.type === 'BUY' ? '↓ קנייה' : '↑ מכירה'}
                              </span>
                            </td>
                            <td>${fmt(t.price, 0)}</td>
                            <td>{t.qty?.toFixed(5) ?? '—'}</td>
                            <td className={t.profit > 0 ? 'mg-green' : t.profit < 0 ? 'mg-red' : 'mg-muted'}>
                              {t.profit != null ? `$${fmt(t.profit)}` : '—'}
                            </td>
                            <td className="mg-muted">
                              {t.time ? new Date(t.time).toLocaleString('he-IL', {
                                timeZone: 'Asia/Jerusalem', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}
        </div>
      )}

      {/* ── TradingView BTC chart ── */}
      <div className="mg-chart-wrap">
        <div className="mg-chart-title">גרף BTC/USDT — 15M</div>
        <div className="mg-chart-container">
          <AlertChartPanel symbol="BTC" isCrypto defaultTf="15m" />
        </div>
      </div>

    </div>
  );
}
