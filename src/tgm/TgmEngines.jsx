// TGM · מעבדת מנועים — UI למערכת מנועי הלידים המרובים.
// דשבורד (סטטיסטיקה חודשית + דירוג מנועים) + טאב/כרטיס לכל מנוע עם הלידים היומיים.
// שומר על שפת העיצוב: RTL עברית, dark, gold accents.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ENGINES } from './engines';
import { loadLeads, runDailyRound, seedHistory, clearLeads } from './store';
import {
  computeStats,
  rankEngines,
  leadsForMonth,
  availableMonths,
  monthLabel,
  MIN_SAMPLE_FOR_RATE,
} from './stats';
import { loadLiveData, clearLiveData, dataMode, liveStats } from './data/dataLayer';
import { TP_PCT, SL_PCT, WINDOW_DAYS } from './evaluator';
import { compareThresholds, edgeVerdict } from './compare';
import { TREND_TIERS } from './trend';
import { fetchPaper, triggerPaperCron } from './paper';
import './TgmEngines.css';

// חיווי מקור נתונים כן (LIVE / חלקי / MOCK).
function DataModeBadge({ mode, info }) {
  if (mode === 'live')
    return <span className="tge-badge tge-badge--live" title={`נטענו ${info.liveSymbols}/${info.total} סימבולים מ-Yahoo`}>🟢 LIVE · נתונים אמיתיים</span>;
  if (mode === 'partial')
    return <span className="tge-badge tge-badge--partial" title={`${info.liveSymbols}/${info.total} חי, השאר DEMO`}>🟡 חלקי · {info.liveSymbols}/{info.total} חי</span>;
  return <span className="tge-badge tge-badge--mock" title="נתוני דמו דטרמיניסטיים — לחץ 'התחבר לנתונים חיים'">⚪ MOCK · נתוני דמו</span>;
}

const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// תצוגת אחוז הצלחה לפי כללי חלק ד׳/ו׳.
function winRateDisplay(stats) {
  if (!stats || stats.resolved === 0) return { text: 'אין מספיק נתונים', dim: true };
  if (stats.resolved < MIN_SAMPLE_FOR_RATE) return { text: 'מדגם קטן מדי', dim: true };
  return { text: `${stats.winRate.toFixed(1)}%`, dim: false };
}

function pf(v) {
  if (v == null) return '—';
  if (v === Infinity) return '∞';
  return v.toFixed(2);
}
function pct(v, sign = false) {
  if (v == null) return '—';
  return `${sign && v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function fmtDay(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function TgmEngines() {
  const [leads, setLeads] = useState([]);
  const [tab, setTab] = useState('dashboard'); // 'dashboard' | engineKey
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [monthSel, setMonthSel] = useState(null); // {year,month,key}
  const [mode, setMode] = useState(dataMode());    // 'live' | 'partial' | 'mock'
  const [info, setInfo] = useState(liveStats());

  // טעינה ראשונית — אם ריק, זורע היסטוריה כדי שיהיה מה להציג.
  useEffect(() => {
    let current = loadLeads();
    if (current.length === 0) {
      setStatus('⏳ זורע היסטוריית לידים (30 ימי מסחר) להרצה ראשונה…');
      current = seedHistory(30);
      setStatus(`✓ נוצרו ${current.length} לידים על פני 30 ימי מסחר.`);
    }
    setLeads(current);
  }, []);

  const months = useMemo(() => availableMonths(leads), [leads]);

  // ברירת מחדל לחודש הנבחר — החודש החדש ביותר שיש בו לידים.
  useEffect(() => {
    if (!monthSel && months.length) setMonthSel(months[0]);
  }, [months, monthSel]);

  const monthLeads = useMemo(
    () => (monthSel ? leadsForMonth(leads, monthSel.year, monthSel.month) : leads),
    [leads, monthSel]
  );

  const overall = useMemo(() => computeStats(monthLeads), [monthLeads]);
  const ranking = useMemo(() => rankEngines(monthLeads), [monthLeads]);
  const comparison = useMemo(() => (tab === 'compare' ? compareThresholds(monthLeads) : null), [monthLeads, tab]);

  const runToday = useCallback(async () => {
    setBusy(true);
    setStatus('🔄 מריץ סבב יומי (היום) על כל המנועים…');
    try {
      const merged = runDailyRound(Date.now());
      setLeads(merged);
      setStatus(`✓ סבב יומי הושלם — ${merged.length} לידים בסך הכול.`);
    } finally {
      setBusy(false);
    }
  }, []);

  const reseed = useCallback(async () => {
    setBusy(true);
    setStatus('📅 זורע היסטוריה חודשית (30 ימי מסחר)…');
    try {
      const merged = seedHistory(30);
      setLeads(merged);
      setStatus(`✓ היסטוריה עודכנה — ${merged.length} לידים.`);
    } finally {
      setBusy(false);
    }
  }, []);

  const wipe = useCallback(() => {
    if (!window.confirm('למחוק את כל לידי המנועים? פעולה זו אינה הפיכה.')) return;
    clearLeads();
    setLeads([]);
    setMonthSel(null);
    setStatus('כל לידי המנועים נמחקו.');
  }, []);

  // ── חיבור לנתונים אמיתיים (LIVE): מושך נרות מ-Yahoo דרך /api/candles, ואז ──
  // מחשב מחדש את כל ההיסטוריה על הנתונים האמיתיים. שקיפות: חיווי מתעדכן ל-LIVE/חלקי.
  const connectLive = useCallback(async () => {
    setBusy(true);
    setStatus('🔌 מתחבר לנתונים אמיתיים (Yahoo /api/candles)… מושך סדרה שנתית לכל סימבול.');
    try {
      const res = await loadLiveData({
        onProgress: (done, total) => setStatus(`📡 מושך נתונים אמיתיים… ${done}/${total} סימבולים`),
      });
      setMode(dataMode());
      setInfo(liveStats());
      setStatus(`✓ חוברו ${res.ok}/${res.total} סימבולים חי. מחשב מחדש היסטוריה על נתונים אמיתיים…`);
      clearLeads();
      const merged = seedHistory(40);
      setLeads(merged);
      setStatus(`✅ ${res.ok}/${res.total} סימבולים LIVE · ${merged.length} לידים חושבו מחדש על נתונים אמיתיים (forward window ${WINDOW_DAYS} ימים).`);
    } catch (e) {
      setStatus(`⚠️ חיבור הנתונים נכשל: ${e.message}. נשאר על MOCK.`);
    } finally {
      setBusy(false);
    }
  }, []);

  const backToMock = useCallback(() => {
    clearLiveData();
    setMode(dataMode());
    setInfo(liveStats());
    clearLeads();
    const merged = seedHistory(40);
    setLeads(merged);
    setStatus('↩︎ חזרה לנתוני MOCK (דמו). הלידים חושבו מחדש.');
  }, []);

  return (
    <div className="tge-wrap" dir="rtl">
      {/* כותרת */}
      <div className="tge-header">
        <div>
          <h3 className="tge-title">🧪 מעבדת מנועי לידים</h3>
          <p className="tge-sub">
            {ENGINES.length} מנועים עצמאיים · סימולציית forward {WINDOW_DAYS} ימים (TP +{TP_PCT}% / SL −{SL_PCT}%) · כניסה ב-D+1 (ללא look-ahead) ·{' '}
            <DataModeBadge mode={mode} info={info} />
          </p>
        </div>
      </div>

      {/* בקרה */}
      <div className="tge-controls">
        {mode === 'mock'
          ? <button className="tge-btn tge-btn--live" onClick={connectLive} disabled={busy}>🔌 התחבר לנתונים חיים</button>
          : <button className="tge-btn" onClick={backToMock} disabled={busy}>↩︎ חזרה ל-MOCK</button>}
        <button className="tge-btn tge-btn--gold" onClick={runToday} disabled={busy}>🔄 הרץ סבב יומי</button>
        <button className="tge-btn" onClick={reseed} disabled={busy}>📅 זרע היסטוריה חודשית</button>
        <button className="tge-btn tge-btn--danger" onClick={wipe} disabled={busy}>🗑️ נקה</button>
        {months.length > 0 && (
          <label className="tge-month">
            <span>חודש:</span>
            <select
              value={monthSel ? monthSel.key : ''}
              onChange={(e) => setMonthSel(months.find((m) => m.key === e.target.value) || null)}
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>{monthLabel(m.year, m.month)}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {status && <div className="tge-status">{status}</div>}

      {/* טאבים */}
      <div className="tge-tabs">
        <button className={`tge-tab ${tab === 'dashboard' ? 'tge-tab--on' : ''}`} onClick={() => setTab('dashboard')}>
          📊 דשבורד
        </button>
        <button className={`tge-tab ${tab === 'compare' ? 'tge-tab--on' : ''}`} onClick={() => setTab('compare')}>
          ⚖️ חוסן 8%↔10%
        </button>
        <button className={`tge-tab ${tab === 'paper' ? 'tge-tab--on' : ''}`} onClick={() => setTab('paper')}>
          📝 Paper Trading חי
        </button>
        {ENGINES.map((e) => (
          <button
            key={e.key}
            className={`tge-tab ${tab === e.key ? 'tge-tab--on' : ''}`}
            onClick={() => setTab(e.key)}
            style={tab === e.key ? { borderColor: e.color, color: e.color } : undefined}
          >
            {e.icon} {e.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? (
        <Dashboard overall={overall} ranking={ranking} monthSel={monthSel} />
      ) : tab === 'compare' ? (
        <ComparePanel cmp={comparison} />
      ) : tab === 'paper' ? (
        <PaperPanel />
      ) : (
        <EngineView engineKey={tab} leads={monthLeads} />
      )}

      <div className="tge-disclaimer">
        ⚠️ מנועי הקטליסט וה-M&A פועלים כרגע על נתוני MOCK — מסומן TODO לחיבור API אמיתי. מידע ומחקר בלבד, לא ייעוץ השקעות.
      </div>
    </div>
  );
}

// ── דשבורד: שלושה מספרים + סטטיסטיקה + טבלת דירוג ──────────────────────────
function Dashboard({ overall, ranking, monthSel }) {
  const wr = winRateDisplay(overall);
  return (
    <>
      {/* שלושה מספרים נפרדים: הצליחו / נכשלו / בשגיאה */}
      <div className="tge-triple">
        <div className="tge-triple-card tge-triple--win">
          <div className="tge-triple-num">{overall.succeeded}</div>
          <div className="tge-triple-lbl">✓ הצליחו</div>
        </div>
        <div className="tge-triple-card tge-triple--loss">
          <div className="tge-triple-num">{overall.failed}</div>
          <div className="tge-triple-lbl">✕ נכשלו</div>
        </div>
        <div className="tge-triple-card tge-triple--err">
          <div className="tge-triple-num">{overall.errored}</div>
          <div className="tge-triple-lbl">⚠️ בשגיאה (לא הוכרעו)</div>
        </div>
      </div>

      {/* סיכום ביצועים חודשי (כולל) */}
      <div className="tge-kpis">
        <Kpi label="אחוז הצלחה" value={wr.text} dim={wr.dim} strong />
        <Kpi label="לידים שנוצרו" value={overall.generated} />
        <Kpi label="הוכרעו תקין" value={overall.resolved} />
        <Kpi label="תשואה ממוצעת/ליד" value={pct(overall.avgReturn, true)} />
        <Kpi label="Profit Factor" value={pf(overall.profitFactor)} />
        <Kpi label="Max Drawdown" value={overall.maxDrawdown == null ? '—' : `${overall.maxDrawdown.toFixed(2)}%`} />
      </div>

      {/* טבלת דירוג מנועים */}
      <div className="tge-section-title">🏆 דירוג מנועים {monthSel ? `· ${monthLabel(monthSel.year, monthSel.month)}` : ''}</div>
      <div className="tge-table-card">
        <table className="tge-table">
          <thead>
            <tr>
              <th>דירוג</th><th>מנוע</th><th>לידים</th><th>הוכרעו</th>
              <th>הצלחה</th><th>תשואה/ליד</th><th>PF</th><th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => {
              const wrr = winRateDisplay(row);
              return (
                <tr key={row.engineKey} className={row.eligible ? '' : 'tge-row--dim'}>
                  <td>{row.rank ? <span className="tge-medal">#{row.rank}</span> : <span className="tge-dash">—</span>}</td>
                  <td><span style={{ color: row.color, fontWeight: 700 }}>{row.icon} {row.label}</span></td>
                  <td>{row.generated}</td>
                  <td>{row.resolved}</td>
                  <td className={wrr.dim ? 'tge-dim' : ''} style={!wrr.dim ? { fontWeight: 800, color: rateColor(row.winRate) } : undefined}>
                    {wrr.text}
                  </td>
                  <td style={retColor(row.avgReturn)}>{pct(row.avgReturn, true)}</td>
                  <td>{pf(row.profitFactor)}</td>
                  <td>{row.maxDrawdown == null ? '—' : `${row.maxDrawdown.toFixed(2)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="tge-table-foot">
          דירוג רשמי מ-{MIN_SAMPLE_FOR_RATE} טריידים שהוכרעו ומעלה · אחוז הצלחה מחושב רק על טריידים שהוכרעו תקין (שגיאות לא נספרות)
        </div>
      </div>
    </>
  );
}

const TREND_ORDER = { green: 3, yellow: 2, red: 1, unknown: 0 };

// ── תצוגת מנוע בודד: סטטיסטיקה + לידים יומיים צבעוניים ──────────────────────
function EngineView({ engineKey, leads }) {
  const eng = ENGINES.find((e) => e.key === engineKey);
  const [greenOnly, setGreenOnly] = useState(false);  // טוגל "רק מגמה עולה 🟢"
  const [sortByTrend, setSortByTrend] = useState(false); // מיון לפי איכות מגמה

  const allEngineLeads = useMemo(
    () => leads.filter((l) => l.engineKey === engineKey),
    [leads, engineKey]
  );
  // הסטטיסטיקה נשארת על כל הלידים (הפילטר משפיע רק על התצוגה, לא על המדדים).
  const stats = useMemo(() => computeStats(allEngineLeads), [allEngineLeads]);
  const wr = winRateDisplay(stats);

  const greenCount = useMemo(() => allEngineLeads.filter((l) => l.trend?.tier === 'green').length, [allEngineLeads]);

  const engineLeads = useMemo(() => {
    let rows = greenOnly ? allEngineLeads.filter((l) => l.trend?.tier === 'green') : [...allEngineLeads];
    rows.sort((a, b) => {
      if (sortByTrend) {
        const d = (TREND_ORDER[b.trend?.tier] ?? 0) - (TREND_ORDER[a.trend?.tier] ?? 0);
        if (d !== 0) return d;
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
    return rows;
  }, [allEngineLeads, greenOnly, sortByTrend]);

  return (
    <>
      <div className="tge-engine-head" style={{ borderRightColor: eng.color }}>
        <div className="tge-engine-name" style={{ color: eng.color }}>{eng.icon} {eng.label}</div>
        <div className="tge-engine-desc">{eng.description}</div>
      </div>

      <div className="tge-triple">
        <div className="tge-triple-card tge-triple--win"><div className="tge-triple-num">{stats.succeeded}</div><div className="tge-triple-lbl">✓ הצליחו</div></div>
        <div className="tge-triple-card tge-triple--loss"><div className="tge-triple-num">{stats.failed}</div><div className="tge-triple-lbl">✕ נכשלו</div></div>
        <div className="tge-triple-card tge-triple--err"><div className="tge-triple-num">{stats.errored}</div><div className="tge-triple-lbl">⚠️ בשגיאה</div></div>
      </div>

      <div className="tge-kpis">
        <Kpi label="אחוז הצלחה" value={wr.text} dim={wr.dim} strong />
        <Kpi label="תשואה ממוצעת/ליד" value={pct(stats.avgReturn, true)} />
        <Kpi label="Profit Factor" value={pf(stats.profitFactor)} />
        <Kpi label="Max Drawdown" value={stats.maxDrawdown == null ? '—' : `${stats.maxDrawdown.toFixed(2)}%`} />
      </div>

      <div className="tge-section-title">📋 לידים יומיים ({engineLeads.length}{greenOnly ? ` / ${allEngineLeads.length}` : ''})</div>

      {/* בקרת מגמה: טוגל "רק מגמה עולה 🟢" + מיון לפי איכות מגמה */}
      <div className="tge-trend-controls">
        <button
          className={`tge-toggle ${greenOnly ? 'tge-toggle--on' : ''}`}
          onClick={() => setGreenOnly((v) => !v)}
          title="הצג רק לידים שסווגו 'מגמה שנתית עולה — תיקון בריא'"
        >
          🟢 רק מגמה עולה {greenOnly ? '✓' : ''} <span className="tge-toggle-count">({greenCount})</span>
        </button>
        <button
          className={`tge-toggle ${sortByTrend ? 'tge-toggle--on' : ''}`}
          onClick={() => setSortByTrend((v) => !v)}
          title="מיין מהמגמה החזקה (🟢) לחלשה (🔴)"
        >
          ↕️ מיין לפי איכות מגמה {sortByTrend ? '✓' : ''}
        </button>
      </div>

      <div className="tge-leads">
        {engineLeads.length === 0 && (
          <div className="tge-empty">{greenOnly ? 'אין לידים במגמה עולה 🟢 למנוע זה בחודש הנבחר.' : 'אין לידים למנוע זה בחודש הנבחר.'}</div>
        )}
        {engineLeads.slice(0, 150).map((l) => (
          <div key={l.id} className={`tge-lead tge-lead--${l.status}`}>
            <div className="tge-lead-top">
              <span className="tge-lead-sym">{l.symbol}</span>
              {l.meta?.name && <span className="tge-lead-co">{l.meta.name}</span>}
              <TrendChip trend={l.trend} />
              <StatusChip lead={l} />
            </div>
            <div className="tge-lead-reason">{l.reason}</div>
            <div className="tge-lead-row">
              <span>כניסה <b>${r2(l.entry)}</b></span>
              <span>יציאה <b>{l.exitPrice == null ? '—' : `$${r2(l.exitPrice)}`}</b></span>
              <span style={retColor(l.pnlPct)}>{l.pnlPct == null ? '—' : pct(l.pnlPct, true)}</span>
              <span className="tge-lead-exit">{exitReasonLabel(l.exitReason)}</span>
              <span className="tge-lead-date">{fmtDay(l.timestamp)}</span>
            </div>
            {l.trend?.metrics && (
              <div className="tge-lead-trend">
                {TREND_TIERS[l.trend.tier]?.emoji} {l.trend.label}
                {l.trend.source === 'mock' && <span className="tge-mock-tag"> (MOCK)</span>}
                {' · '}תשואה שנתית {pct(l.trend.metrics.annualReturnPct, true)}
                {' · '}מרחק משיא {pct(l.trend.metrics.drawdownFromHighPct)}
                {l.trend.metrics.sma50 != null && <> {' · '}SMA50 ${l.trend.metrics.sma50} / SMA200 ${l.trend.metrics.sma200}</>}
              </div>
            )}
            {l.status === 'error' && <div className="tge-lead-err">⚠️ {l.error}</div>}
          </div>
        ))}
      </div>
      {engineLeads.length > 150 && <div className="tge-more">מוצגים 150 מתוך {engineLeads.length}. כולם נכללים בסטטיסטיקה.</div>}
    </>
  );
}

// ── פאנל בדיקת חוסן: 8% מול 10% צד-לצד ──────────────────────────────────────
function ComparePanel({ cmp }) {
  if (!cmp) return null;
  const [tpBase, tpTest] = cmp.thresholds;
  const cell = (s) => {
    const wr = winRateDisplay(s);
    return (
      <>
        <td className={wr.dim ? 'tge-dim' : ''} style={!wr.dim ? { fontWeight: 800, color: rateColor(s.winRate) } : undefined}>{wr.text}</td>
        <td>{s.succeeded}/{s.resolved}</td>
        <td>{pf(s.profitFactor)}</td>
        <td style={retColor(s.avgReturn)}>{pct(s.avgReturn, true)}</td>
        <td>{s.maxDrawdown == null ? '—' : `${s.maxDrawdown.toFixed(1)}%`}</td>
      </>
    );
  };
  const Row = ({ icon, label, color, byTp, drop }) => {
    const v = edgeVerdict(drop);
    return (
      <tr>
        <td><span style={{ color, fontWeight: 700 }}>{icon} {label}</span></td>
        {cell(byTp[tpBase])}
        {cell(byTp[tpTest])}
        <td style={{ fontWeight: 800, color: v.tone === 'good' ? 'var(--accent-green)' : v.tone === 'bad' ? 'var(--accent-red)' : 'var(--accent-gold)' }}>
          {drop == null ? '—' : `${drop > 0 ? '−' : '+'}${Math.abs(drop).toFixed(1)}pp`}
        </td>
        <td className="tge-verdict">{v.text}</td>
      </tr>
    );
  };
  return (
    <>
      <div className="tge-section-title">⚖️ בדיקת חוסן — TP +{tpBase}% (בסיס) מול +{tpTest}% (בדיקה)</div>
      <p className="tge-sub" style={{ marginBottom: 10 }}>
        אותם לידים בדיוק · SL ‎−{cmp.sl}%‎ וחלון {cmp.windowDays} ימים קבועים · ה-TP <b>לא שונה</b> במערכת — זו בדיקה בלבד.
        ירידה קטנה ⇐ edge חזק; צניחה חדה ⇐ הרווח ב-{tpBase}% היה "בקושי".
      </p>
      <div className="tge-table-card" style={{ overflowX: 'auto' }}>
        <table className="tge-table tge-table--cmp">
          <thead>
            <tr>
              <th rowSpan={2}>מנוע</th>
              <th colSpan={5} className="tge-th-grp">TP +{tpBase}%</th>
              <th colSpan={5} className="tge-th-grp tge-th-grp--test">TP +{tpTest}%</th>
              <th rowSpan={2}>ירידה</th><th rowSpan={2}>פסק</th>
            </tr>
            <tr>
              <th>הצלחה</th><th>מנצחים</th><th>PF</th><th>תשואה</th><th>DD</th>
              <th>הצלחה</th><th>מנצחים</th><th>PF</th><th>תשואה</th><th>DD</th>
            </tr>
          </thead>
          <tbody>
            <Row icon="📊" label="כל המנועים" color="var(--accent-gold)" byTp={cmp.overall}
                 drop={(() => { const a = cmp.overall[tpBase].winRate, b = cmp.overall[tpTest].winRate; return a != null && b != null ? Math.round((a - b) * 100) / 100 : null; })()} />
            {cmp.perEngine.map((e) => <Row key={e.engineKey} {...e} />)}
          </tbody>
        </table>
        <div className="tge-table-foot">
          "ירידה" = הפרש ה-win-rate בנקודות אחוז (pp) מ-{tpBase}% ל-{tpTest}%. אחוז מוצג רק ל-≥{MIN_SAMPLE_FOR_RATE} טריידים שהוכרעו.
        </div>
      </div>
    </>
  );
}

// ── פאנל Paper Trading חי (LIVE PAPER) ──────────────────────────────────────
function PaperPanel() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    const d = await fetchPaper();
    setData(d);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000); // רענון כל דקה
    return () => clearInterval(t);
  }, [refresh]);

  const runNow = useCallback(async () => {
    setBusy(true);
    setNote('⏳ מפעיל סבב Paper Trading (סורק את השוק ומעדכן פוזיציות)…');
    const r = await triggerPaperCron(true);
    if (r.ok) setNote(`✓ סבב הושלם — נפתחו ${r.opened ?? 0}, נסגרו ${r.closed ?? 0}, עודכנו ${r.updated ?? 0}.`);
    else setNote(`⚠️ ${r.reason || r.error || 'הסבב לא רץ'}`);
    await refresh();
    setBusy(false);
  }, [refresh]);

  if (!data) return <div className="tge-empty">⏳ טוען track record…</div>;

  const clock = data.clock || {};
  const clockLine = (
    <div className="tge-paper-clock">
      🕐 שוק ארה"ב: <b>{clock.session === 'regular' ? '🟢 פתוח' : clock.session === 'closed' ? '🔴 סגור' : `🟡 ${clock.session}`}</b>
      {' · '}{clock.etDate} {clock.etTime} ET ({clock.weekday})
    </div>
  );

  if (!data.configured) {
    return (
      <div className="tge-paper">
        <div className="tge-section-title">📝 Paper Trading חי — track record קדימה (LIVE PAPER)</div>
        {clockLine}
        <div className="tge-paper-setup">
          <p><b>המנגנון בנוי ומוכן, וממתין לאחסון ענן.</b> כדי להתחיל מעקב חי:</p>
          <ol>
            <li>הגדר ב-Vercel את משתני הסביבה <code>UPSTASH_REDIS_REST_URL</code> ו-<code>UPSTASH_REDIS_REST_TOKEN</code> (אותו Upstash שכבר משמש את שאר הרובוטים).</li>
            <li>ה-cron <code>/api/tgm-paper-cron</code> כבר רשום ב-<code>vercel.json</code> — ירוץ אוטומטית בשעות המסחר (כל 15 דק׳, ימים א׳–ה׳), <b>גם כשהמחשב סגור</b>.</li>
            <li>בפתיחת המסחר הוא פותח פוזיציות וירטואליות מסיגנלים אמיתיים, ועוקב חי עד TP +8% / SL −4% או תום חלון 10 ימים.</li>
          </ol>
          <p className="tge-dim">סיבה נוכחית: {data.reason}</p>
        </div>
        <PaperDisclaimer />
      </div>
    );
  }

  const s = data.summary || {};
  const open = data.open || [];
  const closed = data.closed || [];
  const wrText = s.resolved === 0 ? 'אין מספיק נתונים' : s.sampleTooSmall ? 'מדגם קטן מדי' : `${s.winRate.toFixed(1)}%`;

  return (
    <div className="tge-paper">
      <div className="tge-section-title">📝 Paper Trading חי — LIVE PAPER {s.startedEtDate ? `· מאז ${s.startedEtDate}` : ''}</div>
      {clockLine}

      <div className="tge-controls" style={{ marginTop: 8 }}>
        <button className="tge-btn" onClick={refresh} disabled={busy}>🔄 רענן</button>
        <button className="tge-btn tge-btn--live" onClick={runNow} disabled={busy}>▶️ פתח/עדכן עכשיו</button>
      </div>
      {note && <div className="tge-status">{note}</div>}

      <div className="tge-kpis">
        <Kpi label="שווי פורטפוליו" value={`$${(s.portfolioValue ?? 0).toLocaleString()}`} strong />
        <Kpi label="רווח/הפסד ממומש" value={`$${(s.realizedUsd ?? 0).toLocaleString()}`} />
        <Kpi label="לא ממומש (פתוחות)" value={`$${(s.unrealizedUsd ?? 0).toLocaleString()}`} />
        <Kpi label="אחוז הצלחה (חי)" value={wrText} dim={s.sampleTooSmall} strong />
        <Kpi label="פתוחות / סגורות" value={`${s.openCount ?? 0} / ${s.closedCount ?? 0}`} />
        <Kpi label="Profit Factor" value={pf(s.profitFactor)} />
      </div>

      <div className="tge-section-title">📈 פוזיציות פתוחות ({open.length})</div>
      <div className="tge-leads">
        {open.length === 0 && <div className="tge-empty">אין פוזיציות פתוחות כרגע.</div>}
        {open.map((o) => (
          <div key={o.id} className="tge-lead tge-lead--open">
            <div className="tge-lead-top">
              <span className="tge-lead-sym">{o.symbol}</span>
              {o.name && <span className="tge-lead-co">{o.name}</span>}
              <span className="tge-chip tge-chip--live-paper">LIVE PAPER</span>
            </div>
            <div className="tge-lead-reason">{o.reason}</div>
            <div className="tge-lead-row">
              <span>כניסה <b>${r2(o.entry)}</b></span>
              <span>נוכחי <b>${r2(o.lastPrice)}</b></span>
              <span style={retColor(o.lastPnlPct)}>{pct(o.lastPnlPct, true)}</span>
              <span className="tge-lead-exit">TP ${r2(o.tp)} / SL ${r2(o.sl)}</span>
              <span className="tge-lead-date">יום {o.daysHeld ?? 0}/10</span>
            </div>
          </div>
        ))}
      </div>

      <div className="tge-section-title">📋 track record (נסגרו: {closed.length})</div>
      <div className="tge-leads">
        {closed.length === 0 && <div className="tge-empty">עדיין לא נסגרו פוזיציות.</div>}
        {closed.slice(0, 100).map((c) => (
          <div key={c.id + c.closedAt} className={`tge-lead tge-lead--${c.status}`}>
            <div className="tge-lead-top">
              <span className="tge-lead-sym">{c.symbol}</span>
              {c.name && <span className="tge-lead-co">{c.name}</span>}
              <span className={`tge-chip tge-chip--${c.status}`}>{c.status === 'win' ? '✓ הצליח' : '✕ נכשל'}</span>
            </div>
            <div className="tge-lead-row">
              <span>כניסה <b>${r2(c.entry)}</b></span>
              <span>יציאה <b>${r2(c.exitPrice)}</b></span>
              <span style={retColor(c.pnlPct)}>{pct(c.pnlPct, true)}</span>
              <span style={retColor(c.pnlUsd)}>${r2(c.pnlUsd)}</span>
              <span className="tge-lead-exit">{c.exitReason === 'TP' ? 'TP +8%' : c.exitReason === 'SL' ? 'SL −4%' : 'תום חלון'}</span>
              <span className="tge-lead-date">{c.daysHeld}י׳ · {c.closedEtDate}</span>
            </div>
          </div>
        ))}
      </div>

      <PaperDisclaimer />
    </div>
  );
}

function PaperDisclaimer() {
  return (
    <div className="tge-disclaimer">
      ⚠️ <b>Paper Trading (מסחר נייר, אפס כסף).</b> מתעלם מ-slippage, spread, מילוי חלקי וזמינות מניה — לכן
      התוצאות אופטימיות מול כסף אמיתי, אך הרבה יותר כנות מ-backtest (זהו מעקב <b>קדימה</b> בזמן אמת).
      מחיר הכניסה "בפתיחה" מבוסס על המחיר בטיק ה-cron הראשון אחרי הפתיחה ולא תמיד בר-השגה במציאות.
      גודל פוזיציה אחיד $5,000 מתוך פורטפוליו וירטואלי $100K. כל מספר LIVE PAPER נצבר מאז התאריך המצוין.
    </div>
  );
}

function Kpi({ label, value, dim, strong }) {
  return (
    <div className="tge-kpi">
      <div className={`tge-kpi-val ${dim ? 'tge-dim' : ''} ${strong ? 'tge-kpi-val--strong' : ''}`}>{value}</div>
      <div className="tge-kpi-lbl">{label}</div>
    </div>
  );
}

function StatusChip({ lead }) {
  if (lead.status === 'win') return <span className="tge-chip tge-chip--win">✓ הצליח</span>;
  if (lead.status === 'loss') return <span className="tge-chip tge-chip--loss">✕ נכשל</span>;
  if (lead.status === 'open') return <span className="tge-chip tge-chip--open" title={lead.error}>⏳ פתוח</span>;
  return <span className="tge-chip tge-chip--err" title={lead.error}>⚠️ שגיאה</span>;
}

// תג מגמה שנתית 🟢/🟡/🔴 + תווית קצרה. מסומן (MOCK) אם המקור אינו חי.
function TrendChip({ trend }) {
  if (!trend) return null;
  const t = TREND_TIERS[trend.tier] || TREND_TIERS.unknown;
  const title = trend.metrics
    ? `${trend.label} · תשואה שנתית ${trend.metrics.annualReturnPct}% · מרחק משיא ${trend.metrics.drawdownFromHighPct}%${trend.source === 'mock' ? ' · נתוני MOCK' : ''}`
    : trend.label;
  return (
    <span className={`tge-chip tge-trend-chip tge-trend--${trend.tier}`} title={title}>
      {t.emoji} {t.short}{trend.source === 'mock' ? <span className="tge-mock-tag"> (MOCK)</span> : ''}
    </span>
  );
}

function exitReasonLabel(r) {
  if (r === 'TP') return 'TP +8%';
  if (r === 'SL') return 'SL −4%';
  if (r === 'CLOSE') return 'סגירת יום';
  return '';
}
function rateColor(wr) {
  if (wr == null) return 'var(--text-secondary)';
  return wr >= 55 ? 'var(--accent-green)' : wr >= 45 ? 'var(--accent-gold)' : 'var(--accent-red)';
}
function retColor(v) {
  if (v == null) return { color: 'var(--text-secondary)' };
  return { color: v > 0 ? 'var(--accent-green)' : v < 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: 700 };
}
