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
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ROBOT_TABS } from '../components/RobotNavTabs';
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
import {
  recordBuy, updateBook, rankByLiveReturn, summarize, liveReturn,
} from '../engine/offirPaper';
import { clockStatus } from '../../api/_marketClock.js';
import './PlusOffirPage.css';

const LS_WATCHLIST = 'beepai_offir_watchlist';
const LS_HUNT = 'beepai_offir_hunt';
const LS_BASE = 'beepai_offir_base';   // מחיר-בסיס מרגע ההוספה למעקב (ל"אחוז מאז מעקב")
const LS_PAPER = 'beepai_offir_paper'; // מעקב STRONG BUY וירטואלי (paper tracking)
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
      const c = buildCandidate(q, a, { sector: oq?.sector });
      if (c) {
        // attach the Stage-3 recommendation → STRONG BUY discoveries feed paper-tracking
        const catStrong = detectCatalystHeadline(oq?.headlines).strong;
        const badges = convictionBadges(oq || {}, catStrong);
        c.reco = recommend({ analysis: a, badges, catalystStrong: catStrong }).level;
        c.localHigh = a.dip?.localHigh ?? null;
        c.entryPrice = Number.isFinite(q.price) ? q.price : (a.last ?? null);
      }
      return c;
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
function loadBase() { try { return JSON.parse(localStorage.getItem(LS_BASE)) || {}; } catch { return {}; } }
function saveBase(m) { try { localStorage.setItem(LS_BASE, JSON.stringify(m)); } catch { /* ignore */ } }
function loadPaper() { try { const p = JSON.parse(localStorage.getItem(LS_PAPER)); return p && p.positions ? p : { positions: {} }; } catch { return { positions: {} }; } }
function savePaper(b) { try { localStorage.setItem(LS_PAPER, JSON.stringify(b)); } catch { /* ignore */ } }

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
function StockCard({ item, data, loading, onEdit, onRemove, onOpenChart }) {
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
            <button className="po-price po-price--btn" onClick={() => onOpenChart?.(item.ticker)} title="פתח גרף">
              {fmtPrice(data.price)} 📈
            </button>
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

/* ── STRONG BUY paper-tracking (Part 2) ── */
const fmtRet0 = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`);
const fmtRetSigned = (v) => {
  if (v == null) return '—';
  const s = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
  return `${v >= 0 ? '' : ''}${s}%`;   // minus comes naturally; positives no plus (per spec format)
};

function SbButton({ pos, ret, onOpen }) {
  const up = (ret ?? 0) >= 0;
  return (
    <button className="po-sb-btn" onClick={() => onOpen(pos.ticker)} title={`${pos.label || pos.ticker} · וירטואלי $100 · תשואה חיה מהקנייה`}>
      <span className="po-sb-sym">{pos.label || pos.ticker}</span>
      <span className={`po-sb-pct ${up ? 'po-up' : 'po-dn'}`} dir="ltr">{fmtRet0(ret)}</span>
    </button>
  );
}

function SbDropdown({ items, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="po-sb-dd" ref={ref}>
      <button className="po-sb-btn po-sb-more" onClick={() => setOpen(o => !o)} title="כל המניות הווירטואליות">⋯</button>
      {open && (
        <div className="po-sb-menu" role="menu">
          {items.map(({ pos, ret }) => {
            const up = (ret ?? 0) >= 0;
            return (
              <button key={pos.ticker} className="po-sb-mi" onClick={() => { setOpen(false); onOpen(pos.ticker); }}>
                <span>{pos.label || pos.ticker}</span>
                <span className={up ? 'po-up' : 'po-dn'} dir="ltr">{fmtRet0(ret)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaperMark({ label, v }) {
  if (v == null) return <span className="po-pm po-pm--wait">{label} —</span>;
  return <span className={`po-pm ${v >= 0 ? 'po-up' : 'po-dn'}`} dir="ltr">{label} {fmtRetSigned(v)}</span>;
}

function PaperRow({ pos, ret, onOpen }) {
  return (
    <div className="po-paper-row">
      <button className="po-paper-sym" onClick={() => onOpen(pos.ticker)} title="פתח גרף">{pos.label || pos.ticker}</button>
      <span className="po-paper-marks">
        <PaperMark label="D" v={pos.marks?.D} />
        <PaperMark label="W" v={pos.marks?.W} />
        <PaperMark label="M" v={pos.marks?.M} />
        <PaperMark label="HIGH" v={pos.high} />
      </span>
      <span className={`po-paper-live ${(ret ?? 0) >= 0 ? 'po-up' : 'po-dn'}`} dir="ltr">
        {ret == null ? '' : `חי ${fmtRet0(ret)}`}
      </span>
    </div>
  );
}

/* ── robots dropdown (replaces the full RobotNavTabs strip, +OFFIR only) ── */
function RobotsDropdown({ navigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="po-robots" ref={ref}>
      <button className="po-robots-btn" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        ☰ רובוטים <span className="po-robots-caret">▾</span>
      </button>
      {open && (
        <div className="po-robots-menu" role="menu">
          {ROBOT_TABS.map(t => (
            <button key={t.id} className={`po-robots-item${t.id === 'offir' ? ' po-robots-item--on' : ''}`}
              role="menuitem" onClick={() => { setOpen(false); if (t.id !== 'offir') navigate(t.id); }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
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

  /* Hunter (Stage 2) */
  const [discoveries, setDiscoveries] = useState([]);
  const [huntLoading, setHuntLoading] = useState(false);
  const [huntTs, setHuntTs] = useState(null);
  const [huntMeta, setHuntMeta] = useState(null);   // { universe, shortlist }
  const [chart, setChart] = useState(null);          // { navList, navIdx, pctLabel } — open chart overlay
  const [baseMap, setBaseMap] = useState(loadBase);  // ticker → { price, at } (baseline since watching)
  const [paper, setPaper] = useState(loadPaper);     // STRONG BUY virtual tracking book

  /* Open chart from a daily-hunter discovery — arrows navigate the discoveries (dip%). */
  const openHunterChart = useCallback((sym) => {
    setDiscoveries(cur => {
      const navList = cur.map(c => ({ symbol: c.symbol, pct: c.displayPct, mcap: c.marketCap, isCrypto: false }));
      const i = cur.findIndex(c => c.symbol === sym);
      setChart({ navList, navIdx: i >= 0 ? i : 0, pctLabel: 'עומק ירידה מהשיא' });
      return cur;
    });
  }, []);

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
      // baseline price the first time we see this ticker → "אחוז מאז מעקב"
      if (Number.isFinite(res.price)) {
        setBaseMap(prev => {
          if (prev[item.ticker]?.price) return prev;
          const next = { ...prev, [item.ticker]: { price: res.price, at: Date.now() } };
          saveBase(next); return next;
        });
      }
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

  /* Open chart from a watchlist card — arrows navigate the watchlist; pct = gain since watching. */
  const openWatchlistChart = useCallback((ticker) => {
    const navList = watchlist.map(w => {
      const d = dataMap[w.ticker];
      const base = baseMap[w.ticker]?.price;
      const price = d?.price;
      const gain = (Number.isFinite(price) && Number.isFinite(base) && base > 0)
        ? ((price - base) / base) * 100 : null;
      return { symbol: w.apiSymbol || resolveApiSymbol(w.ticker), pct: gain, mcap: d?.marketCap, isCrypto: false };
    });
    const i = watchlist.findIndex(w => w.ticker === ticker);
    setChart({ navList, navIdx: i >= 0 ? i : 0, pctLabel: 'אחוז מאז מעקב' });
  }, [watchlist, dataMap, baseMap]);

  /* ── STRONG BUY paper tracking (Part 2) ── */
  // current prices keyed by API symbol (discoveries + watchlist)
  const paperPrices = useMemo(() => {
    const m = {};
    discoveries.forEach(c => { if (Number.isFinite(c.price)) m[c.symbol] = c.price; });
    watchlist.forEach(w => {
      const d = dataMap[w.ticker];
      const sym = w.apiSymbol || resolveApiSymbol(w.ticker);
      if (Number.isFinite(d?.price)) m[sym] = d.price;
    });
    return m;
  }, [discoveries, dataMap, watchlist]);

  // record STRONG BUY calls (once each) + capture D/W/M/HIGH marks as time passes
  useEffect(() => {
    const now = Date.now();
    const buys = [];
    discoveries.forEach(c => {
      const price = Number.isFinite(c.entryPrice) ? c.entryPrice : c.price;
      if (c.reco === 'strong_buy' && Number.isFinite(price)) {
        buys.push({ ticker: c.symbol, price, localHigh: c.localHigh, ts: now, label: c.symbol });
      }
    });
    watchlist.forEach(w => {
      const d = dataMap[w.ticker];
      if (d?.reco?.level === 'strong_buy' && Number.isFinite(d.price)) {
        const sym = w.apiSymbol || resolveApiSymbol(w.ticker);
        buys.push({ ticker: sym, price: d.price, localHigh: d.analysis?.dip?.localHigh ?? null, ts: now, label: w.ticker });
      }
    });
    setPaper(prev => {
      let book = prev, dirty = false;
      for (const b of buys) { const nb = recordBuy(book, b); if (nb !== book) { book = nb; dirty = true; } }
      const upd = updateBook(book, paperPrices, now);
      if (upd.changed) { book = upd.book; dirty = true; }
      if (!dirty) return prev;
      savePaper(book);
      return book;
    });
  }, [discoveries, dataMap, watchlist, paperPrices]);

  const openPaperChart = useCallback((sym) => {
    const ranked = rankByLiveReturn(paper, paperPrices);
    const navList = ranked.map(({ pos, ret }) => ({ symbol: pos.ticker, pct: ret, isCrypto: false }));
    const i = ranked.findIndex(({ pos }) => pos.ticker === sym);
    setChart({ navList, navIdx: i >= 0 ? i : 0, pctLabel: 'תשואה חיה מהקנייה' });
  }, [paper, paperPrices]);

  const paperRanked = useMemo(() => rankByLiveReturn(paper, paperPrices), [paper, paperPrices]);
  const paperSummary = useMemo(() => summarize(paper, paperPrices), [paper, paperPrices]);

  // summary
  const liveCount = Object.values(dataMap).filter(d => d?.source === 'LIVE').length;
  const total = watchlist.length;
  const greens = Object.values(dataMap).filter(d => d?.analysis?.status === 'green').length;

  return (
    <div className="po-wrap" dir="rtl">
      {/* Custom top bar (replaces global PageTopBar for +OFFIR) — no back button */}
      <div className="po-topbar">
        <div className="po-topbar-right">
          <h2 className="po-topbar-title">➕ +OFFIR — סורק ביטחונות</h2>
          <RobotsDropdown navigate={navigate} />
        </div>
        <div className="po-topbar-left">
          <button className="po-close" onClick={() => navigate('home')} aria-label="סגור ועבור לדף הבית">✕</button>
          <button className="po-refresh" onClick={() => setRefreshTick(t => t + 1)} aria-label="רענן ניתוח">⟳ רענן</button>
          {greens > 0 && <span className="po-summary-green">🟢 {greens} כניסה</span>}
          <span className={`po-src po-src--${liveCount === total && total ? 'live' : 'mock'}`}>
            {liveCount}/{total} LIVE
          </span>
        </div>
      </div>

      {/* ── STRONG BUY overview row (Part 2.5) — above the daily hunter ── */}
      {paperRanked.length > 0 && (
        <div className="po-sb-wrap">
          <span className="po-sb-label">🏆 STRONG BUY <span className="po-sb-demo">וירטואלי</span></span>
          <div className="po-sb-row">
            {paperRanked.slice(0, 7).map(({ pos, ret }) => (
              <SbButton key={pos.ticker} pos={pos} ret={ret} onOpen={openPaperChart} />
            ))}
            <SbDropdown items={paperRanked} onOpen={openPaperChart} />
          </div>
        </div>
      )}

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
        {discoveries.map(c => <HunterButton key={c.symbol} c={c} onOpen={openHunterChart} />)}
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
            onOpenChart={openWatchlistChart}
          />
        ))}
        {watchlist.length === 0 && (
          <div className="po-empty">אין מניות במעקב — הוסף טיקר למעלה.</div>
        )}
      </div>

      {/* ── STRONG BUY virtual tracking table (Part 2.3/2.4) ── */}
      <div className="po-section-title">📊 מעקב STRONG BUY <span className="po-sb-demo">וירטואלי / DEMO</span></div>
      {paperSummary.count > 0 ? (
        <>
          <div className="po-paper-summary">
            {paperSummary.count} קריאות · {paperSummary.winPct != null ? `${paperSummary.winPct.toFixed(0)}% ירוקות (חי)` : '—'}
            {paperSummary.avgHigh != null && <> · תשואת HIGH ממוצעת {paperSummary.avgHigh.toFixed(0)}%</>}
          </div>
          <div className="po-paper-list">
            {paperRanked.map(({ pos, ret }) => (
              <PaperRow key={pos.ticker} pos={pos} ret={ret} onOpen={openPaperChart} />
            ))}
          </div>
        </>
      ) : (
        <div className="po-paper-empty">
          עדיין אין קריאות STRONG BUY. ברגע שמניה תקבל המלצת STRONG BUY (ממנוע ההמלצה) — היא "תיקנה" וירטואלית ב-$100 ותימדד כאן ב-4 נקודות: D (יום) · W (שבוע) · M (חודש) · HIGH (חזרה לשיא).
        </div>
      )}

      {editing && (
        <EditModal item={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
      )}

      {/* Chart overlay — reuses AlertChartPanel; ◄► navigate the context list */}
      {chart && (
        <div className="po-chart-overlay" onClick={() => setChart(null)}>
          <div className="po-chart-box" onClick={e => e.stopPropagation()}>
            <div className="po-chart-iframe">
              <AlertChartPanel
                symbol={chart.navList?.[chart.navIdx]?.symbol}
                isCrypto={false} defaultTf="1D"
                navList={chart.navList} navStartIndex={chart.navIdx} navPctLabel={chart.pctLabel}
              />
            </div>
            <button className="po-chart-x" onClick={() => setChart(null)} aria-label="סגור גרף">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
