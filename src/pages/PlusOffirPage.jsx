/**
 * PlusOffirPage.jsx — רובוט "+OFFIR" (סורק ביטחונות / Conviction Scanner).
 *
 * שלב 1 / MVP: Watchlist דינמי (5 סלוטים, ניתן למחוק/להחליף, נשמר בריענון)
 * + מנוע ניתוח טכני (offirModel) שמתייג כל מניה 🟢/🟡/🔴 לפי תעלת המגמה.
 *
 * דאטה: שכבת ה-proxy הקיימת — /api/candles (Yahoo, שנה נרות יומיים) ל-TA,
 * ו-/api/stock-detail ל-market-cap + מחיר LIVE. אם הפרוקסי לא מחזיר נרות,
 * המנוע רץ על נתוני MOCK דטרמיניסטיים — והכרטיס מסומן MOCK בבירור.
 *
 * בידוד: קומפוננטה עצמאית. אינה נוגעת בשום רובוט קיים.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import RobotNavTabs from '../components/RobotNavTabs';
import { apiUrl } from '../utils/apiBase';
import {
  analyzeOffir, mockCandles, resolveApiSymbol,
  DEFAULT_WATCHLIST, OFFIR_CRITERIA,
} from '../engine/offirModel';
import './PlusOffirPage.css';

const LS_WATCHLIST = 'beepai_offir_watchlist';

/* ── persistence ─────────────────────────────────────────────── */
function loadWatchlist() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_WATCHLIST));
    if (Array.isArray(s) && s.length) {
      return s
        .filter(x => x && x.ticker)
        .map(x => ({
          ticker: String(x.ticker).toUpperCase(),
          apiSymbol: x.apiSymbol || resolveApiSymbol(x.ticker),
          name: x.name || '',
          type: x.type === 'ETF' ? 'ETF' : 'STOCK',
          catalyst: x.catalyst || '',
        }));
    }
  } catch { /* ignore */ }
  return DEFAULT_WATCHLIST.map(x => ({ ...x }));
}
function saveWatchlist(list) {
  try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(list)); } catch { /* ignore */ }
}

/* ── data fetch for one symbol ───────────────────────────────── */
async function fetchSymbolData(item) {
  const sym = item.apiSymbol || resolveApiSymbol(item.ticker);
  let candles = [];
  let marketCap = null, livePrice = null, liveName = null;

  // 1y daily candles (TA engine input)
  try {
    const r = await fetch(apiUrl(`/api/candles?symbol=${encodeURIComponent(sym)}&interval=1d`));
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.candles)) candles = d.candles; }
  } catch { /* fall through to MOCK */ }

  // quote: market-cap + live price + name
  try {
    const r = await fetch(apiUrl(`/api/stock-detail?symbol=${encodeURIComponent(sym)}`));
    if (r.ok) {
      const d = await r.json();
      if (Number.isFinite(d.market_cap)) marketCap = d.market_cap;
      if (Number.isFinite(d.price)) livePrice = d.price;
      else if (Array.isArray(d.prices) && d.prices.length) {
        const p = d.prices[d.prices.length - 1];
        if (Number.isFinite(p)) livePrice = p;
      }
      // Yahoo often returns just the ticker as "name" when the quote feed is blocked —
      // keep the nicer static company name in that case.
      if (d.name && d.name.toUpperCase() !== sym.toUpperCase()) liveName = d.name;
    }
  } catch { /* keep nulls */ }

  const isLive = candles.length > 0;
  if (!isLive) candles = mockCandles(item.ticker);

  const analysis = analyzeOffir(candles, { marketCap, assetType: item.type });
  const price = livePrice ?? analysis.last ?? null;

  return { source: isLive ? 'LIVE' : 'MOCK', price, marketCap, name: liveName || item.name, analysis };
}

const fmtMcap = (m) => {
  if (!Number.isFinite(m)) return '—';
  if (m >= 1e12) return `$${(m / 1e12).toFixed(2)}T`;
  if (m >= 1e9)  return `$${(m / 1e9).toFixed(2)}B`;
  if (m >= 1e6)  return `$${(m / 1e6).toFixed(0)}M`;
  return `$${m}`;
};
const fmtPrice = (p) => (Number.isFinite(p) ? `$${p < 10 ? p.toFixed(2) : p.toLocaleString('en', { maximumFractionDigits: 2 })}` : '—');

const STATUS_META = {
  green:  { dot: '🟢', cls: 'po-st--green',  label: 'כניסה'  },
  yellow: { dot: '🟡', cls: 'po-st--yellow', label: 'המתן'   },
  red:    { dot: '🔴', cls: 'po-st--red',    label: 'זהירות' },
};

/* ── channel position bar (0% תחתון → 100% עליון) ─────────────── */
function ChannelBar({ pos, broke }) {
  const clamped = pos == null ? 50 : Math.max(-8, Math.min(108, pos));
  // entry zone = bottom 25%
  return (
    <div className="po-chan" title={pos == null ? '—' : `מיקום בתעלה: ${pos.toFixed(0)}%`}>
      <div className="po-chan-track">
        <div className="po-chan-entry" />
        <div
          className={`po-chan-marker${broke ? ' po-chan-marker--broke' : ''}`}
          style={{ bottom: `${Math.max(0, Math.min(100, clamped))}%` }}
        />
      </div>
      <div className="po-chan-labels">
        <span>עליון</span>
        <span>{pos == null ? '—' : `${pos.toFixed(0)}%`}</span>
        <span>תחתון</span>
      </div>
    </div>
  );
}

function CriteriaList({ criteria }) {
  return (
    <ul className="po-crit">
      {OFFIR_CRITERIA.map(({ key, label }) => {
        const c = criteria[key] || {};
        const mark = c.unknown || c.pass == null ? '⚠️' : c.pass ? '✓' : '✗';
        const cls = c.unknown || c.pass == null ? 'po-crit--na' : c.pass ? 'po-crit--ok' : 'po-crit--no';
        return (
          <li key={key} className={`po-crit-row ${cls}`}>
            <span className="po-crit-mark">{mark}</span>
            <span className="po-crit-label">{label}{c.partial ? ' *' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── one watchlist card ──────────────────────────────────────── */
function StockCard({ item, data, loading, onEdit, onRemove }) {
  const st = data ? STATUS_META[data.analysis.status] : null;
  return (
    <div className={`po-card${st ? ' ' + st.cls : ''}`}>
      <div className="po-card-head">
        <div className="po-card-id">
          <span className="po-ticker">{item.ticker}</span>
          <span className={`po-type po-type--${item.type.toLowerCase()}`}>{item.type}</span>
        </div>
        <div className="po-card-actions">
          {data && (
            <span className={`po-src po-src--${data.source.toLowerCase()}`}>{data.source}</span>
          )}
          <button className="po-edit-btn" onClick={() => onEdit(item)} aria-label={`ערוך ${item.ticker}`}>✎</button>
        </div>
      </div>

      <div className="po-card-name">{(data?.name) || item.name || '—'}</div>

      {loading && <div className="po-card-loading">טוען ניתוח…</div>}

      {!loading && data && (
        <>
          <div className="po-card-row">
            <span className="po-price">{fmtPrice(data.price)}</span>
            <span className={`po-status ${st.cls}`}>{st.dot} {data.analysis.statusLabel}</span>
          </div>

          <div className="po-card-mid">
            <ChannelBar pos={data.analysis.channelPos} broke={data.analysis.brokeBelow} />
            <div className="po-card-metrics">
              <div className="po-metric"><span>מרקט-קאפ</span><b>{fmtMcap(data.marketCap)}</b></div>
              <div className="po-metric"><span>תנודתיות</span><b>{data.analysis.atrPct != null ? `${data.analysis.atrPct.toFixed(1)}%` : '—'}</b></div>
              <div className="po-metric"><span>SMA200</span><b>{fmtPrice(data.analysis.sma200)}</b></div>
              <CriteriaList criteria={data.analysis.criteria} />
            </div>
          </div>

          <div className="po-reason">{data.analysis.reason}</div>
          {item.catalyst && <div className="po-catalyst">📌 {item.catalyst}</div>}
          {data.analysis.status === 'red' && (
            <div className="po-warn">⚠️ אל תעשה DCA על 🔴</div>
          )}
        </>
      )}

      <button className="po-remove-btn" onClick={() => onRemove(item.ticker)} aria-label={`הסר ${item.ticker}`}>הסר ממעקב</button>
    </div>
  );
}

/* ── edit modal (delete / replace ticker) ────────────────────── */
function EditModal({ item, onSave, onClose }) {
  const [ticker, setTicker] = useState(item?.ticker || '');
  const [type, setType] = useState(item?.type || 'STOCK');
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(t); }, []);
  if (!item) return null;
  const submit = () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    onSave(item.ticker, {
      ticker: t,
      apiSymbol: resolveApiSymbol(t),
      name: t === item.ticker ? item.name : '',
      type,
      catalyst: t === item.ticker ? item.catalyst : '',
    });
  };
  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div className="po-modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="po-modal-title">עריכת סלוט — {item.ticker}</div>
        <label className="po-modal-label">טיקר</label>
        <input
          ref={inputRef}
          className="po-modal-input"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder="לדוגמה: NVDA"
          dir="ltr" autoComplete="off" spellCheck="false"
        />
        <label className="po-modal-label">סוג נכס</label>
        <div className="po-modal-types">
          {['STOCK', 'ETF'].map(t => (
            <button key={t} className={`po-modal-type${type === t ? ' po-modal-type--on' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
        <div className="po-modal-actions">
          <button className="po-modal-save" onClick={submit}>שמור</button>
          <button className="po-modal-cancel" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────── */
export default function PlusOffirPage({ navigate }) {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [dataMap, setDataMap] = useState({});   // ticker → { source, price, marketCap, name, analysis }
  const [loadingSet, setLoadingSet] = useState({});
  const [editing, setEditing] = useState(null);
  const [newTicker, setNewTicker] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  /* Fetch analysis for the whole watchlist (on change / manual refresh). */
  useEffect(() => {
    let cancelled = false;
    setLoadingSet(Object.fromEntries(watchlist.map(i => [i.ticker, true])));
    watchlist.forEach(async (item) => {
      const res = await fetchSymbolData(item);
      if (cancelled) return;
      setDataMap(prev => ({ ...prev, [item.ticker]: res }));
      setLoadingSet(prev => ({ ...prev, [item.ticker]: false }));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.map(i => i.ticker + i.apiSymbol).join(','), refreshTick]);

  const removeItem = useCallback((ticker) => {
    setWatchlist(prev => { const next = prev.filter(i => i.ticker !== ticker); saveWatchlist(next); return next; });
  }, []);

  const addTicker = useCallback((raw) => {
    const t = String(raw).trim().toUpperCase();
    if (!t) return;
    setWatchlist(prev => {
      if (prev.some(i => i.ticker === t)) return prev;
      const next = [...prev, { ticker: t, apiSymbol: resolveApiSymbol(t), name: '', type: 'STOCK', catalyst: '' }];
      saveWatchlist(next);
      return next;
    });
    setNewTicker('');
  }, []);

  const saveEdit = useCallback((oldTicker, updated) => {
    setWatchlist(prev => {
      const next = prev.map(i => i.ticker === oldTicker ? { ...i, ...updated } : i);
      saveWatchlist(next);
      return next;
    });
    setEditing(null);
  }, []);

  // summary
  const liveCount = Object.values(dataMap).filter(d => d?.source === 'LIVE').length;
  const total = watchlist.length;
  const greens = Object.values(dataMap).filter(d => d?.analysis?.status === 'green').length;

  return (
    <div className="po-wrap" dir="rtl">
      <RobotNavTabs currentPage="offir" navigate={navigate} />

      {/* Header */}
      <div className="po-header">
        <div>
          <h2 className="po-title">➕ +OFFIR — סורק ביטחונות</h2>
          <p className="po-sub">מסחר ללא סטופ-לוס: מניות במגמה שנתית עולה שירדו לגבול התחתון של תעלת המגמה</p>
        </div>
        <div className="po-summary">
          <span className={`po-src po-src--${liveCount === total && total ? 'live' : 'mock'}`}>
            {liveCount}/{total} LIVE
          </span>
          {greens > 0 && <span className="po-summary-green">🟢 {greens} כניסה</span>}
          <button className="po-refresh" onClick={() => setRefreshTick(t => t + 1)} aria-label="רענן ניתוח">⟳ רענן</button>
        </div>
      </div>

      {/* Methodology disclaimer */}
      <div className="po-disclaimer">
        ⚠️ שיטת מסחר ללא סטופ-לוס מבוססת על שכנוע (conviction) במגמה ובגב חיצוני.
        🔴 = חשד לשבירת מגמה — <strong>אל תעשה DCA</strong>. המידע לצורכי לימוד בלבד, אינו ייעוץ השקעות.
        <span className="po-disc-na"> ⚠️/* = נתון לא זמין מהפרוקסי (לא פוסל). MOCK = נתוני הדמיה מסומנים.</span>
      </div>

      {/* Add slot */}
      <form className="po-add" onSubmit={e => { e.preventDefault(); addTicker(newTicker); }}>
        <input
          className="po-add-input"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          placeholder="הוסף טיקר למעקב — NVDA, RIOT, MARA…"
          dir="ltr" autoComplete="off" spellCheck="false"
        />
        <button type="submit" className="po-add-btn">＋ הוסף</button>
      </form>

      {/* Watchlist grid */}
      <div className="po-grid">
        {watchlist.map(item => (
          <StockCard
            key={item.ticker}
            item={item}
            data={dataMap[item.ticker]}
            loading={loadingSet[item.ticker]}
            onEdit={setEditing}
            onRemove={removeItem}
          />
        ))}
        {watchlist.length === 0 && (
          <div className="po-empty">אין מניות במעקב — הוסף טיקר למעלה.</div>
        )}
      </div>

      {/* Stage-2 placeholder */}
      <div className="po-section-title">🔭 תגליות</div>
      <div className="po-discoveries">
        <span className="po-discoveries-soon">צייד אוטומטי — שלב 2 (בקרוב)</span>
      </div>

      {editing && (
        <EditModal item={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
