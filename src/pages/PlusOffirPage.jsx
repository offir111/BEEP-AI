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
import AlertChartPanel from '../components/AlertChartPanel';
import { apiUrl } from '../utils/apiBase';
import {
  analyzeOffir, mockCandles, resolveApiSymbol,
  DEFAULT_WATCHLIST, OFFIR_CRITERIA,
} from '../engine/offirModel';
import {
  huntPrefilter, buildCandidate, rankCandidates,
} from '../engine/offirHunter';
import {
  detectCatalystHeadline, convictionBadges, recommend,
} from '../engine/offirConviction';
import { clockStatus } from '../../api/_marketClock.js';
import './PlusOffirPage.css';

const LS_WATCHLIST = 'beepai_offir_watchlist';
const LS_HUNT = 'beepai_offir_hunt';
const HUNT_REFRESH_MS = 10 * 60 * 1000;   // re-hunt every 10 min while market is open
const HUNT_REFRESH_LABEL = '10 דק׳';

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
  let sector = null, industry = null, week52High = null;
  let quote = {};   // conviction-layer fields (Stage 3)

  // 1y daily candles (TA engine input) — מגמה/תנודתיות/ירידה-מהשיא
  try {
    const r = await fetch(apiUrl(`/api/candles?symbol=${encodeURIComponent(sym)}&interval=1d`));
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.candles)) candles = d.candles; }
  } catch { /* fall through to MOCK */ }

  // OFFIR fundamentals (Finviz mcap+sector, Yahoo price+52wk) — קריטריונים 1,2,6
  try {
    const r = await fetch(apiUrl(`/api/offir-quote?symbol=${encodeURIComponent(sym)}&type=${item.type}`));
    if (r.ok) {
      const d = await r.json();
      if (Number.isFinite(d.marketCap)) marketCap = d.marketCap;
      if (Number.isFinite(d.price)) livePrice = d.price;
      if (Number.isFinite(d.week52High)) week52High = d.week52High;
      if (d.sector) sector = d.sector;
      if (d.industry) industry = d.industry;
      if (d.name && d.name.toUpperCase() !== sym.toUpperCase()) liveName = d.name;
      quote = {
        analystRecom: d.analystRecom ?? null, targetPrice: d.targetPrice ?? null,
        instOwn: d.instOwn ?? null, relVolume: d.relVolume ?? null,
        avgVolume: d.avgVolume ?? null, headlines: Array.isArray(d.headlines) ? d.headlines : [],
      };
    }
  } catch { /* keep nulls — criteria mark ⚠️ unknown, never silently pass */ }

  const isLive = candles.length > 0;
  if (!isLive) candles = mockCandles(item.ticker);

  const hint = `${item.name || ''} ${item.catalyst || ''}`;
  const analysis = analyzeOffir(candles, {
    marketCap, assetType: item.type,
    sector, industry, hint,
    catalyst: item.catalyst || '',
    week52High,
  });
  const price = livePrice ?? analysis.last ?? null;

  // ── Conviction layer (Stage 3): badges + catalyst headline + recommendation ──
  const catalystInfo = detectCatalystHeadline(quote.headlines);
  const badges = convictionBadges(quote, catalystInfo.strong);
  const reco = recommend({ analysis, badges, catalystStrong: catalystInfo.strong });

  return {
    source: isLive ? 'LIVE' : 'MOCK',
    price, marketCap, sector, industry,
    name: liveName || item.name, analysis,
    quote, badges, reco, catalystInfo,
  };
}

/* ── Hunter (Stage 2): scan the live gainers stream for dip-in-uptrend setups ──
 * Reuses existing infra only: /api/tv-screener (universe), /api/candles (TA),
 * /api/offir-quote (sector). Inverse filter + Stage-1 analyzeOffir + conviction score.
 */
async function runHunt() {
  let universe = [];
  try {
    const r = await fetch(apiUrl(`/api/tv-screener?period=1y&cap=all&_t=${Date.now()}`));
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.quotes)) universe = d.quotes; }
  } catch { /* no universe → empty discoveries */ }

  const shortlist = huntPrefilter(universe);

  const results = await Promise.all(shortlist.map(async (q) => {
    try {
      const [cd, oq] = await Promise.all([
        fetch(apiUrl(`/api/candles?symbol=${encodeURIComponent(q.symbol)}&interval=1d`)).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(apiUrl(`/api/offir-quote?symbol=${encodeURIComponent(q.symbol)}&type=STOCK`)).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const candles = Array.isArray(cd?.candles) ? cd.candles : [];
      if (!candles.length) return null;                  // no LIVE candles → don't guess
      const a = analyzeOffir(candles, {
        marketCap: q.market_cap, assetType: 'STOCK',
        sector: oq?.sector, industry: oq?.industry,
        hint: `${q.name || ''} ${oq?.sector || ''}`,
        week52High: oq?.week52High,
      });
      return buildCandidate(q, a, { sector: oq?.sector });
    } catch { return null; }
  }));

  return { ranked: rankCandidates(results), ts: Date.now(), universe: universe.length, shortlist: shortlist.length };
}

const todayKey = () => new Date().toISOString().slice(0, 10);   // YYYY-MM-DD (daily cache)
function loadHuntCache() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_HUNT));
    if (c && c.date === todayKey() && Array.isArray(c.ranked)) return c;
  } catch { /* ignore */ }
  return null;
}
function saveHuntCache(ranked, ts) {
  try { localStorage.setItem(LS_HUNT, JSON.stringify({ date: todayKey(), ts, ranked })); } catch { /* ignore */ }
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

/* ערך מדיד קצר לכל קריטריון — מוכיח שהבדיקה אמיתית (לא תחושה). */
function critValue(key, c) {
  if (c == null) return '';
  const v = c.value;
  switch (key) {
    case 'marketCap':  return Number.isFinite(v) ? fmtMcap(v) : (c.unknown ? '—' : '');
    case 'hotSector':  return v || (c.unknown ? '—' : '');
    case 'catalyst':   return c.unknown ? 'אין' : c.pass ? 'חיובי' : 'חלש';
    case 'uptrend':    return Number.isFinite(v) ? (v > 0 ? 'עולה' : 'יורד') : '';
    case 'volatility': return Number.isFinite(v) ? `${v.toFixed(1)}%` : '';
    case 'dipFromHigh': return Number.isFinite(v) ? `${v.toFixed(0)}%` : '';
    default: return '';
  }
}

function CriteriaList({ criteria }) {
  return (
    <ul className="po-crit">
      {OFFIR_CRITERIA.map(({ key, label }) => {
        const c = criteria[key] || {};
        const na = c.unknown || c.pass == null;
        const mark = na ? '⚠️' : c.pass ? '✓' : '✗';
        const cls = na ? 'po-crit--na' : c.pass ? 'po-crit--ok' : 'po-crit--no';
        const val = critValue(key, c);
        return (
          <li key={key} className={`po-crit-row ${cls}`}>
            <span className="po-crit-mark">{mark}</span>
            <span className="po-crit-label">{label}{c.partial ? ' *' : ''}</span>
            {val && <span className="po-crit-val">{val}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ── recommendation header (Part D) ── */
const RECO_CLS = {
  green: 'po-reco--green', blue: 'po-reco--blue', yellow: 'po-reco--yellow',
  gray: 'po-reco--gray', red: 'po-reco--red',
};
function Recommendation({ reco }) {
  if (!reco) return null;
  return (
    <div className={`po-reco ${RECO_CLS[reco.color] || 'po-reco--gray'}`}>
      <span className="po-reco-label">{reco.label}</span>
      {reco.conviction && <span className="po-reco-conv">רמת שכנוע: {reco.conviction}</span>}
      {reco.dcaOk && <span className="po-reco-dca">DCA מאושר ✓</span>}
      <span className="po-reco-reason">{reco.reason}</span>
    </div>
  );
}

/* ── conviction badges (Part B) — green only on real data, tooltip = real value ── */
function Badges({ badges }) {
  if (!badges) return null;
  const items = [
    { key: 'volume', icon: '📊', label: 'ווליום', b: badges.volume,
      tip: badges.volume.known ? `נפח יחסי ×${badges.volume.value}` : 'אין נתון נפח' },
    { key: 'analyst', icon: '👔', label: 'אנליסטים', b: badges.analyst,
      tip: badges.analyst.known ? `Recom ${badges.analyst.value}${badges.analyst.target ? ` · יעד $${badges.analyst.target}` : ''}` : 'אין המלצת אנליסטים' },
    { key: 'inst', icon: '🏛️', label: 'מוסדיים', b: badges.institutional,
      tip: badges.institutional.known ? `אחזקה מוסדית ${badges.institutional.value}%` : 'אין נתון אחזקה' },
    { key: 'cat', icon: '📰', label: 'קטליסט', b: badges.catalyst,
      tip: badges.catalyst.on ? 'קטליסט חזק זוהה בכותרות' : badges.catalyst.known ? 'אין קטליסט חזק בכותרות' : 'אין כותרות' },
  ];
  return (
    <div className="po-badges">
      {items.map(it => {
        const cls = it.b.on ? 'po-badge--on' : it.b.known ? 'po-badge--off' : 'po-badge--na';
        return (
          <span key={it.key} className={`po-badge ${cls}`} title={it.tip}>
            <span className="po-badge-ic">{it.icon}</span>{it.label}
          </span>
        );
      })}
      <span className="po-src po-src--live po-badge-live">LIVE</span>
    </div>
  );
}

/* ── latest news headline (real, from Finviz) — user reads & judges ── */
function Headline({ info }) {
  const h = info?.latest;
  if (!h) return null;
  return (
    <a className={`po-headline${info.strong ? ' po-headline--strong' : ''}`}
       href={h.url} target="_blank" rel="noreferrer" title="פתח כתבה במקור">
      📰 {info.strong && <span className="po-headline-fire">🔥 קטליסט</span>}
      <span className="po-headline-txt">{h.title}</span>
      {h.date && <span className="po-headline-date">· {h.date}</span>}
    </a>
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
          {/* Recommendation — top of card (Part D) */}
          <Recommendation reco={data.reco} />

          <div className="po-card-row">
            <span className="po-price">{fmtPrice(data.price)}</span>
            <span className={`po-status ${st.cls}`}>{st.dot} {data.analysis.statusLabel}</span>
          </div>

          <div className="po-card-mid">
            <ChannelBar pos={data.analysis.channelPos} broke={data.analysis.brokeBelow} />
            <div className="po-card-metrics">
              <div className="po-metric"><span>מרקט-קאפ</span><b>{Number.isFinite(data.marketCap) ? fmtMcap(data.marketCap) : (data.analysis.assetType === 'ETF' ? 'ETF' : '—')}</b></div>
              <div className="po-metric"><span>סקטור</span><b>{data.sector || '—'}</b></div>
              <div className="po-metric"><span>ירידה מהשיא</span><b>{data.analysis.dip?.dipPct != null ? `${data.analysis.dip.dipPct.toFixed(0)}%` : '—'}</b></div>
              <CriteriaList criteria={data.analysis.criteria} />
            </div>
          </div>

          {/* Conviction badges + real news headline (Parts B/C) */}
          <Badges badges={data.badges} />
          <Headline info={data.catalystInfo} />

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

/* ── Hunter discovery button (compact, MiniTile-style: ticker + dip%) ── */
function HunterButton({ c, onOpen }) {
  const tier = c.score >= 80 ? 'po-hunt-score--hot' : c.score >= 60 ? 'po-hunt-score--good' : 'po-hunt-score--mild';
  const dn = (c.displayPct ?? 0) < 0;
  return (
    <button className="po-hunt-btn" onClick={() => onOpen(c.symbol)} title={`${c.name || c.symbol} · ציון כניסה ${c.score}/100 · 1Y ${c.pct_1y}% · פתח גרף`}>
      <span className={`po-hunt-score ${tier}`}>{c.score}</span>
      <span className="po-hunt-sym">{c.symbol}</span>
      <span className={`po-hunt-pct ${dn ? 'po-dn' : 'po-up'}`} dir="ltr">
        {dn ? '' : '+'}{Number.isFinite(c.displayPct) ? c.displayPct.toFixed(0) : '—'}%
      </span>
      {c.hotSector && <span className="po-hunt-fire" title={`סקטור חם: ${c.sector}`}>🔥</span>}
    </button>
  );
}

/* "עודכן לפני X" — same idea as GainersPage TsBar */
function HuntAge({ ts }) {
  const [age, setAge] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const tick = () => setAge(Math.round((Date.now() - ts) / 1000));
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [ts]);
  if (!ts) return null;
  const txt = age < 90 ? `${age}ש׳` : age < 5400 ? `${Math.round(age / 60)} דק׳` : `${Math.round(age / 3600)} ש׳`;
  return <span className="po-hunt-age">עודכן לפני {txt}</span>;
}

/* ── main page ───────────────────────────────────────────────── */
export default function PlusOffirPage({ navigate }) {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [dataMap, setDataMap] = useState({});   // ticker → { source, price, marketCap, name, analysis }
  const [loadingSet, setLoadingSet] = useState({});
  const [editing, setEditing] = useState(null);
  const [newTicker, setNewTicker] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  /* Hunter (Stage 2) */
  const [discoveries, setDiscoveries] = useState([]);
  const [huntLoading, setHuntLoading] = useState(false);
  const [huntTs, setHuntTs] = useState(null);
  const [huntMeta, setHuntMeta] = useState(null);   // { universe, shortlist }
  const [chartSym, setChartSym] = useState(null);    // open chart overlay

  const doHunt = useCallback(async () => {
    setHuntLoading(true);
    try {
      const { ranked, ts, universe, shortlist } = await runHunt();
      setDiscoveries(ranked);
      setHuntTs(ts);
      setHuntMeta({ universe, shortlist });
      saveHuntCache(ranked, ts);
    } finally {
      setHuntLoading(false);
    }
  }, []);

  /* On mount: use today's cache if present, else hunt. Re-hunt daily. */
  useEffect(() => {
    const cached = loadHuntCache();
    if (cached) { setDiscoveries(cached.ranked); setHuntTs(cached.ts); }
    else { doHunt(); }
  }, [doHunt]);

  /* Market clock (Part E) — connect the existing _marketClock helper. */
  const [clock, setClock] = useState(() => clockStatus());
  useEffect(() => {
    const iv = setInterval(() => setClock(clockStatus()), 30 * 1000);
    return () => clearInterval(iv);
  }, []);

  /* Re-hunt on the US-market OPEN transition (16:30 IL). */
  const prevOpenRef = useRef(clock.isOpen);
  useEffect(() => {
    if (clock.isOpen && !prevOpenRef.current) doHunt();
    prevOpenRef.current = clock.isOpen;
  }, [clock.isOpen, doHunt]);

  /* While the market is open, refresh every HUNT_REFRESH_MS until close. */
  useEffect(() => {
    if (!clock.isOpen) return;
    const iv = setInterval(() => doHunt(), HUNT_REFRESH_MS);
    return () => clearInterval(iv);
  }, [clock.isOpen, doHunt]);

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

      {/* ── Hunter discoveries (Stage 2) — top of page, above watchlist ── */}
      <div className="po-hunt-head">
        <div className="po-section-title">🔭 תגליות — צייד אוטומטי</div>
        <div className="po-hunt-meta">
          <span className={`po-mkt ${clock.isOpen ? 'po-mkt--open' : 'po-mkt--closed'}`} title={`שעון ניו-יורק ${clock.etTime} · ${clock.session}`}>
            {clock.isOpen ? '🟢 שוק פתוח'
              : clock.session === 'pre' ? '🌅 טרום-מסחר'
              : clock.session === 'after' ? '🌆 אחרי-שוק'
              : '🔴 שוק סגור'}
          </span>
          <HuntAge ts={huntTs} />
          <button className="po-hunt-refresh" onClick={doHunt} disabled={huntLoading} aria-label="סרוק עכשיו">
            {huntLoading ? '… סורק' : '⟳ סרוק'}
          </button>
        </div>
      </div>
      <div className="po-hunt-sub">
        מניות במגמה שנתית עולה שירדו לנקודת כניסה (dip) — ממוינות לפי עוצמת ההזדמנות (ציון 0–100).
        <span className="po-hunt-cadence">{clock.isOpen ? `מתרענן כל ${HUNT_REFRESH_LABEL}` : 'מתרענן בפתיחת השוק (16:30)'}</span>
        <span className="po-src po-src--live">LIVE · TradingView</span>
      </div>
      <div className="po-hunt-strip">
        {huntLoading && discoveries.length === 0 && <span className="po-hunt-loading">סורק את השוק…</span>}
        {!huntLoading && discoveries.length === 0 && (
          <span className="po-hunt-empty">אין תגליות כרגע — לא נמצא setup של dip-in-uptrend בשוק.</span>
        )}
        {discoveries.map(c => <HunterButton key={c.symbol} c={c} onOpen={setChartSym} />)}
      </div>
      {huntMeta && (
        <div className="po-hunt-note">סרק {huntMeta.universe} מניות חזקות שנתית → {huntMeta.shortlist} מועמדים → {discoveries.length} תגליות שעברו את כל הסינון והבטיחות.</div>
      )}

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

      {editing && (
        <EditModal item={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
      )}

      {/* Chart overlay — reuses the existing AlertChartPanel (same as GainersPage) */}
      {chartSym && (
        <div className="po-chart-overlay" onClick={() => setChartSym(null)}>
          <div className="po-chart-box" onClick={e => e.stopPropagation()}>
            <div className="po-chart-iframe">
              <AlertChartPanel symbol={chartSym} isCrypto={false} defaultTf="1D" />
            </div>
            <button className="po-chart-x" onClick={() => setChartSym(null)} aria-label="סגור גרף">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
