/**
 * ProfileScanner.jsx — אזור המעקב + הסורק בעמוד היוזר.
 *
 * מבנה:
 *   ⭐ מעקב מהיר — קבוצת כפתורים קטנים (ברירת מחדל 6: BTC·ETH·SOL·S&P·HUT8·CIFR).
 *      לחיצה על כפתור טוענת את הסמל לגרף שלמטה (לא פותחת תיבת התראות).
 *   📡 סורק מניות — שורת חיפוש + "סרוק": טוען לגרף, והסמל מופיע ככפתור עם
 *      "➕ הוסף למעקב" שמצרף אותו לקבוצת המעקב למעלה.
 *   גרף נרות מלא (ChartsPage) — שכפול עמוד הגרף inline, דיפולט BTC/USD.
 *
 * הקבוצה נשמרת ב-localStorage (beepai_profile_toplist). בידוד מלא — אינו
 * נוגע בגרף המקורי, ב-8 כפתורי הבית, או בכל רובוט אחר.
 */
import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useAlerts } from '../context/AlertsContext';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';
import ChartsPage from '../pages/ChartsPage';
import { formatPrice, formatChange } from '../utils/format';
import './ProfileScanner.css';

const DEFAULT_SYM = 'BTC';
const LS_TOPLIST  = 'beepai_profile_toplist';
const PRETTY      = { HUT: 'HUT 8' };

/* קבוצת ברירת המחדל (RTL: ראשון = ימני ביותר). */
const DEFAULT_TOP = [
  { sym: 'BTC',  label: 'BTC'   },
  { sym: 'ETH',  label: 'ETH'   },
  { sym: 'SOL',  label: 'SOL'   },
  { sym: 'S&P',  label: 'S&P'   },
  { sym: 'HUT',  label: 'HUT 8' },
  { sym: 'CIFR', label: 'CIFR'  },
];

function loadTop() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_TOPLIST));
    if (Array.isArray(s) && s.length) {
      return s
        .map(x => {
          const sym = String(x.sym ?? x).toUpperCase().trim();
          return sym ? { sym, label: x.label || PRETTY[sym] || sym } : null;
        })
        .filter(Boolean);
    }
  } catch { /* ignore */ }
  return DEFAULT_TOP.map(x => ({ ...x }));
}
function saveTop(list) {
  try { localStorage.setItem(LS_TOPLIST, JSON.stringify(list)); } catch { /* ignore */ }
}

/* ── כפתור מעקב קטן — לחיצה טוענת לגרף ── */
function MiniTile({ sym, label, alertCount, active, onLoad, onRemove }) {
  const { price, change, flash } = useQuote(sym);
  const up = change != null && change >= 0;
  const stateClass = change == null ? 'pfs-tile--flat' : up ? 'pfs-tile--up' : 'pfs-tile--down';
  const flashClass = flash === 'up' ? 'lp-flash-up' : flash === 'down' ? 'lp-flash-down' : '';

  return (
    <div className={`pfs-tile ${stateClass}${active ? ' pfs-tile--on' : ''}`}>
      <button className="pfs-tile-main" onClick={() => onLoad(sym)} title={`טען ${label} לגרף`}>
        {alertCount > 0 && <span className="pfs-tile-badge" title={`${alertCount} התראות פעילות`}>{alertCount}</span>}
        <span className="pfs-tile-sym">{label}</span>
        <span className={`pfs-tile-price ${flashClass}`}>{price != null ? `$${formatPrice(price)}` : '—'}</span>
        <span className="pfs-tile-change">{formatChange(change)}</span>
      </button>
      <button className="pfs-tile-x" onClick={() => onRemove(sym)} aria-label={`הסר ${label} ממעקב`} title="הסר ממעקב">✕</button>
    </div>
  );
}

export default function ProfileScanner() {
  const { alerts } = useAlerts();
  const lqCtx = useContext(LiveQuoteContext);

  const [topList, setTopList]     = useState(loadTop);
  const [current, setCurrent]     = useState(DEFAULT_SYM);
  const [loadNonce, setLoadNonce] = useState(0);
  const [query, setQuery]         = useState('');
  const [searched, setSearched]   = useState(null);   // הסמל האחרון שנסרק (צ'יפ ממתין)

  /* מספר התראות פעילות לכל סמל. */
  const alertCounts = useMemo(() => {
    const m = {}; const now = Date.now();
    for (const a of alerts) {
      if (a.triggered || (a.expiresAt && now >= a.expiresAt)) continue;
      const s = a.symbol.toUpperCase();
      m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [alerts]);

  /* הזנת כל סמלי המעקב לפיד החי (לא מבטלים מנוי — מנוע ההתראות נשען עליו). */
  useEffect(() => {
    if (!lqCtx?.subscribe) return;
    lqCtx.subscribe(topList.map(t => t.sym));
  }, [topList, lqCtx]);

  /* טעינת סמל לגרף (remount של ChartsPage טוען נרות מחדש). */
  const loadSymbol = useCallback((sym) => {
    const s = String(sym || '').trim().toUpperCase();
    if (!s) return;
    setCurrent(s);
    setLoadNonce(n => n + 1);
  }, []);

  const addToTop = useCallback((sym, label) => {
    const s = String(sym || '').trim().toUpperCase();
    if (!s) return;
    setTopList(prev => {
      if (prev.some(t => t.sym === s)) return prev;
      const next = [...prev, { sym: s, label: label || PRETTY[s] || s }];
      saveTop(next);
      return next;
    });
  }, []);

  const removeFromTop = useCallback((sym) => {
    setTopList(prev => { const next = prev.filter(t => t.sym !== sym); saveTop(next); return next; });
  }, []);

  /* "סרוק" — טוען לגרף ומציג צ'יפ עם אפשרות הוספה למעקב. */
  const scan = useCallback((raw) => {
    const s = String(raw ?? query).trim().toUpperCase();
    if (!s) return;
    loadSymbol(s);
    setSearched(s);
    setQuery('');
  }, [query, loadSymbol]);

  const isSaved = searched && topList.some(t => t.sym === searched);

  return (
    <div className="pfs-wrap" dir="rtl">

      {/* ── מעקב — כפתורים קטנים, לחיצה טוענת לגרף (מוצמדים למעלה) ── */}
      <div className="pfs-tiles">
        {topList.map(t => (
          <MiniTile
            key={t.sym}
            sym={t.sym}
            label={t.label}
            alertCount={alertCounts[t.sym] || 0}
            active={current === t.sym}
            onLoad={loadSymbol}
            onRemove={removeFromTop}
          />
        ))}
        {topList.length === 0 && <span className="pfs-empty">אין מניות במעקב — חפש והוסף למטה.</span>}
      </div>

      {/* ── סורק מניות — התווית בתוך שורת החיפוש ── */}
      <form className="pfs-search-row" onSubmit={e => { e.preventDefault(); scan(); }}>
        <span className="pfs-search-label">📡 סורק מניות</span>
        <input
          className="pfs-search-input"
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="סמל — AAPL · CIFR · BTC"
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="סמל לסריקה"
        />
        <button type="submit" className="pfs-scan-btn">🔍 סרוק</button>
      </form>

      {/* צ'יפ הסמל שנסרק — לחיצה טוענת לגרף; ➕ מצרף לקבוצת המעקב */}
      {searched && (
        <div className="pfs-searched">
          <button className="pfs-searched-load" onClick={() => loadSymbol(searched)} title="טען לגרף">{searched}</button>
          {isSaved ? (
            <span className="pfs-searched-saved">✓ במעקב</span>
          ) : (
            <button className="pfs-searched-add" onClick={() => addToTop(searched)}>➕ הוסף למעקב</button>
          )}
        </div>
      )}

      {/* ── גרף הנרות המלא — שכפול עמוד הגרף, inline ── */}
      <div className="pfs-chart-host">
        <ChartsPage key={`${current}-${loadNonce}`} initialSymbol={current} />
      </div>
    </div>
  );
}
