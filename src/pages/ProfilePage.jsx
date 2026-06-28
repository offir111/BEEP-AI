/**
 * ProfilePage.jsx — user profile, reached from the avatar circle (top-left).
 *
 * Layout (RTL):
 *   1. User identity — avatar + name (big) + last-login time.
 *   2. "התראות" heading.
 *   3. A 6-per-row grid of live tiles. Symbols with active price alerts come
 *      first; the rest of the first row is filled with a default baseline
 *      (BTC · ETH · SOL · S&P · HUT 8 · CIFR — first = rightmost square).
 *
 * Each tile shows: symbol name (big), live price, daily % (green/red), and a
 * small badge with the number of active alerts on that symbol. Tapping a tile
 * opens the QuickAlert dialog for that symbol (the price-alert box).
 */
import { useState, useEffect, useContext, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import QuickAlert from '../components/QuickAlert';
import ProfileScanner from '../components/ProfileScanner';
import { formatPrice, formatChange } from '../utils/format';
import './ProfilePage.css';

/* Default baseline tiles — RTL order (first entry = rightmost square). */
const DEFAULT_TILES = [
  { sym: 'BTC',  label: 'BTC'   },
  { sym: 'ETH',  label: 'ETH'   },
  { sym: 'SOL',  label: 'SOL'   },
  { sym: 'S&P',  label: 'S&P'   },
  { sym: 'HUT',  label: 'HUT 8' },
  { sym: 'CIFR', label: 'CIFR'  },
];

/* Pretty labels for symbols that look better with a display name. */
const PRETTY = { HUT: 'HUT 8' };

function Tile({ sym, label, alertCount, onClick }) {
  const { price, change, flash } = useQuote(sym);
  const hasChange = change != null;
  const up = hasChange && change >= 0;

  const stateClass = !hasChange ? 'pf-tile--flat' : up ? 'pf-tile--up' : 'pf-tile--down';
  const flashClass = flash === 'up' ? 'lp-flash-up' : flash === 'down' ? 'lp-flash-down' : '';

  return (
    <button className={`pf-tile ${stateClass}`} onClick={onClick} title={`${label} — הוסף/ערוך התראה`}>
      {alertCount > 0 && (
        <span className="pf-tile-badge" title={`${alertCount} התראות פעילות`}>{alertCount}</span>
      )}
      <span className="pf-tile-sym">{label}</span>
      <span className={`pf-tile-price ${flashClass}`}>
        {price != null ? `$${formatPrice(price)}` : '—'}
      </span>
      <span className="pf-tile-change">{formatChange(change)}</span>
    </button>
  );
}

export default function ProfilePage({ username, loginAt }) {
  const { alerts } = useAlerts();
  const lqCtx = useContext(LiveQuoteContext);
  const [quickSym, setQuickSym] = useState(null);

  /* Active alerts: not yet triggered and not expired. */
  const activeAlerts = useMemo(
    () => alerts.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt)),
    [alerts]
  );

  /* Alert count per symbol (uppercased). */
  const alertCounts = useMemo(() => {
    const m = {};
    for (const a of activeAlerts) {
      const s = a.symbol.toUpperCase();
      m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [activeAlerts]);

  /* Tiles: alerted symbols first (newest alert first), then defaults not already shown. */
  const tiles = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const a of activeAlerts) {
      const s = a.symbol.toUpperCase();
      if (seen.has(s)) continue;
      seen.add(s);
      list.push({ sym: s, label: PRETTY[s] || s });
    }
    for (const d of DEFAULT_TILES) {
      if (seen.has(d.sym)) continue;
      seen.add(d.sym);
      list.push(d);
    }
    return list;
  }, [activeAlerts]);

  /* Subscribe all tile symbols to the live-quote feed.
     We intentionally do NOT unsubscribe on cleanup: the alert engine relies on
     the same subscriptions, and the symbol set here is small. */
  useEffect(() => {
    if (!lqCtx?.subscribe) return;
    lqCtx.subscribe(tiles.map(t => t.sym));
  }, [tiles, lqCtx]);

  const initial = username?.[0]?.toUpperCase() || '?';
  const lastLogin = loginAt
    ? new Date(loginAt).toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div className="pf-wrap">

      {/* ── User identity ── */}
      <div className="pf-head">
        <div className="pf-avatar">{initial}</div>
        <h1 className="pf-name">{username || 'משתמש'}</h1>
        <div className="pf-login">מועד כניסה אחרון: {lastLogin}</div>
      </div>

      {/* ── Alerts section ── */}
      <h2 className="pf-section-title">🔔 התראות</h2>

      <div className="pf-grid">
        {tiles.map(t => (
          <Tile
            key={t.sym}
            sym={t.sym}
            label={t.label}
            alertCount={alertCounts[t.sym] || 0}
            onClick={() => setQuickSym(t.sym)}
          />
        ))}
      </div>

      {quickSym && (
        <QuickAlert symbol={quickSym} onClose={() => setQuickSym(null)} />
      )}

      {/* ── סורק מניות: גרף נרות + מעקב + התראות ── */}
      <ProfileScanner />
    </div>
  );
}
