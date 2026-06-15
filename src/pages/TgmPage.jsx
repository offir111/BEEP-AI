import { useState, useEffect, useCallback, useMemo } from 'react';
import RobotNavTabs from '../components/RobotNavTabs';
import { TGM_PROVIDERS, MIN_TRADES_FOR_RANK } from '../engine/tgmProviders';
import { getAllLeads, saveLead, deleteLead, clearAllLeads, newLeadId } from '../engine/tgmDb';
import { checkLead, getOpenPriceAt } from '../engine/tgmEngine';
import { buildRanking } from '../engine/tgmStats';
import './TgmPage.css';

const COMMON_ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT'];

const EMPTY_FORM = {
  provider: TGM_PROVIDERS[0],
  asset: 'BTC/USDT',
  direction: 'LONG',
  entry: '',
  tp: '',
  sl: '',
  date: '',
};

function fmtNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 4 : 2 });
}

function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function defaultDateLocal() {
  // ברירת מחדל: לפני 7 ימים (כדי שלרוב הלידים כבר תהיה תוצאה).
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TgmPage({ navigate }) {
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: defaultDateLocal() });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const reload = useCallback(async () => {
    try {
      const all = await getAllLeads();
      setLeads(all);
    } catch (e) {
      setStatusMsg('שגיאה בטעינת הנתונים: ' + e.message);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // בדיקת ליד בודד והעדכון ב-DB.
  const runCheck = useCallback(async (lead) => {
    await saveLead({ ...lead, status: 'checking', error: null });
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'checking', error: null } : l)));
    try {
      const r = await checkLead(lead);
      const updated = {
        ...lead,
        status: r.result, // 'win' | 'loss'
        reason: r.reason,
        exitPrice: r.exitPrice,
        closedAtMs: r.closedAtMs,
        checkedAt: Date.now(),
        error: null,
      };
      await saveLead(updated);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      return updated;
    } catch (e) {
      const errored = { ...lead, status: 'error', error: e.message, checkedAt: Date.now() };
      await saveLead(errored);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? errored : l)));
      return errored;
    }
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    const entry = parseFloat(form.entry);
    const tp = parseFloat(form.tp);
    const sl = parseFloat(form.sl);
    const dateMs = form.date ? new Date(form.date).getTime() : NaN;

    if (!form.asset.trim()) return setFormError('יש להזין נכס (לדוגמה BTC/USDT)');
    if (!Number.isFinite(entry) || !Number.isFinite(tp) || !Number.isFinite(sl)) {
      return setFormError('יש להזין מחירי כניסה, יעד וסטופ תקינים');
    }
    if (!Number.isFinite(dateMs)) return setFormError('יש לבחור תאריך');
    if (dateMs > Date.now()) return setFormError('תאריך הליד לא יכול להיות בעתיד');

    // ולידציה לוגית של כיוון מול TP/SL.
    if (form.direction === 'LONG' && !(tp > entry && sl < entry)) {
      return setFormError('ב-LONG: היעד (TP) חייב להיות מעל הכניסה והסטופ (SL) מתחתיה');
    }
    if (form.direction === 'SHORT' && !(tp < entry && sl > entry)) {
      return setFormError('ב-SHORT: היעד (TP) חייב להיות מתחת לכניסה והסטופ (SL) מעליה');
    }

    const lead = {
      id: newLeadId(),
      provider: form.provider,
      asset: form.asset.trim().toUpperCase(),
      direction: form.direction,
      entry,
      tp,
      sl,
      dateMs,
      status: 'pending',
      createdAt: Date.now(),
    };

    setBusy(true);
    setStatusMsg('מוסיף ליד ובודק מול Binance…');
    try {
      await saveLead(lead);
      setLeads((prev) => [lead, ...prev]);
      await runCheck(lead);
      setForm({ ...EMPTY_FORM, provider: form.provider, asset: form.asset, date: defaultDateLocal() });
      setStatusMsg('הליד נוסף ונבדק ✓');
    } catch (err) {
      setStatusMsg('שגיאה בהוספת הליד: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  // בדיקה מחדש של כל הלידים שטרם נבדקו (או שנכשלו).
  const checkAllPending = async () => {
    const pending = leads.filter((l) => l.status === 'pending' || l.status === 'error' || l.status === 'checking');
    if (!pending.length) { setStatusMsg('אין לידים הממתינים לבדיקה'); return; }
    setBusy(true);
    let done = 0;
    for (const l of pending) {
      setStatusMsg(`בודק ${++done}/${pending.length}…`);
      await runCheck(l);
    }
    setBusy(false);
    setStatusMsg(`הבדיקה הושלמה — נבדקו ${pending.length} לידים`);
  };

  const handleDelete = async (id) => {
    await deleteLead(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('למחוק את כל הלידים? פעולה זו אינה הפיכה.')) return;
    await clearAllLeads();
    setLeads([]);
    setStatusMsg('כל הלידים נמחקו');
  };

  // זריעת נתוני דמו ריאליסטיים — מחיר כניסה היסטורי אמיתי מ-Binance.
  const seedDemo = async () => {
    setBusy(true);
    setStatusMsg('יוצר נתוני דמו (מושך מחירים היסטוריים)…');
    const plan = [
      { provider: 'Learn2Trade', count: 24 },
      { provider: 'Wolf of Trading', count: 22 },
      { provider: 'Binance Killers', count: 21 },
      { provider: 'Token Metrics', count: 12 },
      { provider: 'altFINS', count: 8 },
    ];
    const assets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
    let created = 0;
    let total = plan.reduce((s, p) => s + p.count, 0);

    try {
      for (const p of plan) {
        for (let i = 0; i < p.count; i++) {
          // תאריך אקראי בין 90 ל-16 יום אחורה (כדי שחלון 14 הימים יסתיים בעבר).
          const daysAgo = 16 + Math.floor(Math.random() * 74);
          const dateMs = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
          const asset = assets[Math.floor(Math.random() * assets.length)];
          const direction = Math.random() < 0.5 ? 'LONG' : 'SHORT';
          let entry;
          try {
            entry = await getOpenPriceAt(asset, dateMs);
          } catch {
            continue; // מדלג אם אין נתון מחיר
          }
          const tpPct = 0.015 + Math.random() * 0.04; // 1.5%–5.5%
          const slPct = 0.015 + Math.random() * 0.03; // 1.5%–4.5%
          const tp = direction === 'LONG' ? entry * (1 + tpPct) : entry * (1 - tpPct);
          const sl = direction === 'LONG' ? entry * (1 - slPct) : entry * (1 + slPct);
          const lead = {
            id: newLeadId(),
            provider: p.provider,
            asset,
            direction,
            entry: +entry.toFixed(2),
            tp: +tp.toFixed(2),
            sl: +sl.toFixed(2),
            dateMs,
            status: 'pending',
            createdAt: Date.now(),
            demo: true,
          };
          await saveLead(lead);
          const checked = await checkLead(lead).then(
            (r) => ({ ...lead, status: r.result, reason: r.reason, exitPrice: r.exitPrice, closedAtMs: r.closedAtMs, checkedAt: Date.now() }),
            () => ({ ...lead, status: 'error', error: 'check failed' })
          );
          await saveLead(checked);
          created++;
          setStatusMsg(`נוצרו ${created}/${total} לידי דמו…`);
        }
      }
      await reload();
      setStatusMsg(`נתוני דמו נוצרו ונבדקו — ${created} לידים`);
    } catch (e) {
      setStatusMsg('שגיאה ביצירת נתוני דמו: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const ranking = useMemo(() => buildRanking(leads), [leads]);
  const checkedCount = leads.filter((l) => l.status === 'win' || l.status === 'loss').length;
  const pendingCount = leads.filter((l) => l.status === 'pending' || l.status === 'checking' || l.status === 'error').length;

  return (
    <div className="tgm-wrap" dir="rtl">
      <RobotNavTabs currentPage="tgm" navigate={navigate} />

      {/* Header */}
      <div className="tgm-header">
        <div>
          <h2 className="tgm-title">🛰️ TGM — סורק לידים</h2>
          <p className="tgm-sub">מעקב אחר ספקי לידים ודירוגם לפי אחוז הצלחה אמיתי (Binance API)</p>
        </div>
        <div className="tgm-badge">{busy ? '⏳ עובד…' : '🟢 מוכן'}</div>
      </div>

      {statusMsg && <div className="tgm-status">{statusMsg}</div>}

      {/* ── טבלת דירוג ── */}
      <div className="tgm-section-title">🏆 טבלת דירוג ספקים</div>
      <div className="tgm-table-card">
        <table className="tgm-table">
          <thead>
            <tr>
              <th>דירוג</th>
              <th>שם ספק</th>
              <th>מספר טריידים</th>
              <th>אחוז הצלחה</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => {
              const pct = row.trades > 0 ? row.successRate : 0;
              const pctColor = pct >= 60 ? '#4ade80' : pct >= 45 ? '#D4AF37' : '#ef4444';
              return (
                <tr key={row.provider} className={row.eligible ? '' : 'tgm-row--insufficient'}>
                  <td className="tgm-rank-cell">
                    {row.eligible ? <span className="tgm-rank-medal">#{row.rank}</span> : <span className="tgm-rank-dash">—</span>}
                  </td>
                  <td className="tgm-prov-cell">{row.provider}</td>
                  <td>
                    {row.trades}
                    {!row.eligible && (
                      <span className="tgm-insufficient-tag" title={`נדרשים לפחות ${MIN_TRADES_FOR_RANK} טריידים לדירוג רשמי`}>
                        מדגם לא מספיק
                      </span>
                    )}
                  </td>
                  <td>
                    {row.trades > 0 ? (
                      <span style={{ color: pctColor, fontWeight: 800 }}>{pct.toFixed(1)}%</span>
                    ) : (
                      <span className="tgm-rank-dash">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="tgm-table-foot">
          סה״כ {checkedCount} טריידים שנבדקו · {pendingCount} ממתינים · דירוג רשמי מ-{MIN_TRADES_FOR_RANK} טריידים ומעלה
        </div>
      </div>

      {/* ── הזנת ליד ── */}
      <div className="tgm-section-title">➕ הזנת ליד חדש</div>
      <form className="tgm-form" onSubmit={handleAdd}>
        <div className="tgm-form-grid">
          <label className="tgm-field">
            <span>ספק</span>
            <select value={form.provider} onChange={(e) => setField('provider', e.target.value)}>
              {TGM_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="tgm-field">
            <span>נכס</span>
            <input list="tgm-assets" value={form.asset} onChange={(e) => setField('asset', e.target.value)} placeholder="BTC/USDT" />
            <datalist id="tgm-assets">
              {COMMON_ASSETS.map((a) => <option key={a} value={a} />)}
            </datalist>
          </label>

          <label className="tgm-field">
            <span>כיוון</span>
            <div className="tgm-dir-toggle">
              <button type="button" className={`tgm-dir-btn ${form.direction === 'LONG' ? 'tgm-dir-btn--long' : ''}`} onClick={() => setField('direction', 'LONG')}>LONG ▲</button>
              <button type="button" className={`tgm-dir-btn ${form.direction === 'SHORT' ? 'tgm-dir-btn--short' : ''}`} onClick={() => setField('direction', 'SHORT')}>SHORT ▼</button>
            </div>
          </label>

          <label className="tgm-field">
            <span>מחיר כניסה (Entry)</span>
            <input type="number" step="any" value={form.entry} onChange={(e) => setField('entry', e.target.value)} placeholder="0.00" />
          </label>

          <label className="tgm-field">
            <span>יעד (TP)</span>
            <input type="number" step="any" value={form.tp} onChange={(e) => setField('tp', e.target.value)} placeholder="0.00" />
          </label>

          <label className="tgm-field">
            <span>סטופ (SL)</span>
            <input type="number" step="any" value={form.sl} onChange={(e) => setField('sl', e.target.value)} placeholder="0.00" />
          </label>

          <label className="tgm-field">
            <span>תאריך הליד</span>
            <input type="datetime-local" value={form.date} onChange={(e) => setField('date', e.target.value)} max={defaultDateLocal()} />
          </label>
        </div>

        {formError && <div className="tgm-form-error">⚠️ {formError}</div>}

        <div className="tgm-form-actions">
          <button type="submit" className="tgm-btn tgm-btn--add" disabled={busy}>➕ הוסף ובדוק ליד</button>
          <button type="button" className="tgm-btn tgm-btn--check" onClick={checkAllPending} disabled={busy}>🔄 בדוק את כל הממתינים</button>
          <button type="button" className="tgm-btn tgm-btn--demo" onClick={seedDemo} disabled={busy}>🎲 טען נתוני דמו</button>
          <button type="button" className="tgm-btn tgm-btn--clear" onClick={handleClearAll} disabled={busy}>🗑️ נקה הכל</button>
        </div>
      </form>

      {/* ── רשימת לידים ── */}
      <div className="tgm-section-title">📋 לידים ({leads.length})</div>
      <div className="tgm-leads">
        {leads.length === 0 && (
          <div className="tgm-empty">אין לידים עדיין — הזן ליד ידנית או לחץ "טען נתוני דמו".</div>
        )}
        {leads.map((l) => (
          <div key={l.id} className={`tgm-lead-card tgm-lead--${l.status}`}>
            <div className="tgm-lead-main">
              <span className="tgm-lead-prov">{l.provider}</span>
              <span className="tgm-lead-asset">{l.asset}</span>
              <span className={`tgm-lead-dir tgm-lead-dir--${l.direction === 'LONG' ? 'long' : 'short'}`}>
                {l.direction === 'LONG' ? 'LONG ▲' : 'SHORT ▼'}
              </span>
            </div>
            <div className="tgm-lead-prices">
              <span>כניסה <b>{fmtNum(l.entry)}</b></span>
              <span className="tgm-green">TP <b>{fmtNum(l.tp)}</b></span>
              <span className="tgm-red">SL <b>{fmtNum(l.sl)}</b></span>
              <span className="tgm-lead-date">{fmtDate(l.dateMs)}</span>
            </div>
            <div className="tgm-lead-foot">
              <StatusBadge lead={l} />
              <div className="tgm-lead-actions">
                <button className="tgm-mini-btn" onClick={() => runCheck(l)} disabled={busy} title="בדוק מחדש">🔄</button>
                <button className="tgm-mini-btn tgm-mini-btn--del" onClick={() => handleDelete(l.id)} disabled={busy} title="מחק">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="tgm-disclaimer">
        ⚠️ מידע ומחקר בלבד, לא ייעוץ השקעות.
      </div>
    </div>
  );
}

function StatusBadge({ lead }) {
  const { status, reason, exitPrice } = lead;
  if (status === 'win') {
    return <span className="tgm-result tgm-result--win">✓ ניצחון{reason ? ` · ${reason === 'TIME' ? 'מחיר נוכחי' : reason}` : ''}</span>;
  }
  if (status === 'loss') {
    return <span className="tgm-result tgm-result--loss">✕ הפסד{reason ? ` · ${reason === 'TIME' ? 'מחיר נוכחי' : reason}` : ''}</span>;
  }
  if (status === 'checking') return <span className="tgm-result tgm-result--checking">⏳ בודק…</span>;
  if (status === 'error') return <span className="tgm-result tgm-result--error" title={lead.error}>⚠️ שגיאה</span>;
  return <span className="tgm-result tgm-result--pending">• ממתין לבדיקה</span>;
}
