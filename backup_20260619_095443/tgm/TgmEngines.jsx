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
import { dataProviderName } from './data/dataLayer';
import { TP_PCT, SL_PCT } from './evaluator';
import './TgmEngines.css';

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

  return (
    <div className="tge-wrap" dir="rtl">
      {/* כותרת */}
      <div className="tge-header">
        <div>
          <h3 className="tge-title">🧪 מעבדת מנועי לידים</h3>
          <p className="tge-sub">
            {ENGINES.length} מנועים עצמאיים · הערכה יומית אוטומטית (TP +{TP_PCT}% / SL −{SL_PCT}%) · מקור נתונים:{' '}
            <b>{dataProviderName === 'mock' ? 'MOCK (דמו)' : dataProviderName}</b>
          </p>
        </div>
      </div>

      {/* בקרה */}
      <div className="tge-controls">
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

// ── תצוגת מנוע בודד: סטטיסטיקה + לידים יומיים צבעוניים ──────────────────────
function EngineView({ engineKey, leads }) {
  const eng = ENGINES.find((e) => e.key === engineKey);
  const engineLeads = useMemo(
    () => leads.filter((l) => l.engineKey === engineKey).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [leads, engineKey]
  );
  const stats = useMemo(() => computeStats(engineLeads), [engineLeads]);
  const wr = winRateDisplay(stats);

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

      <div className="tge-section-title">📋 לידים יומיים ({engineLeads.length})</div>
      <div className="tge-leads">
        {engineLeads.length === 0 && <div className="tge-empty">אין לידים למנוע זה בחודש הנבחר.</div>}
        {engineLeads.slice(0, 150).map((l) => (
          <div key={l.id} className={`tge-lead tge-lead--${l.status}`}>
            <div className="tge-lead-top">
              <span className="tge-lead-sym">{l.symbol}</span>
              {l.meta?.name && <span className="tge-lead-co">{l.meta.name}</span>}
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
            {l.status === 'error' && <div className="tge-lead-err">⚠️ {l.error}</div>}
          </div>
        ))}
      </div>
      {engineLeads.length > 150 && <div className="tge-more">מוצגים 150 מתוך {engineLeads.length}. כולם נכללים בסטטיסטיקה.</div>}
    </>
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
  return <span className="tge-chip tge-chip--err" title={lead.error}>⚠️ שגיאה</span>;
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
