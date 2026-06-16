import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import RobotNavTabs from '../components/RobotNavTabs';
import { LIVE_PROVIDERS, MIN_TRADES_FOR_RANK } from '../engine/tgmProviders';
import { getAllLeads, saveLead, deleteLead, clearAllLeads, newLeadId } from '../engine/tgmDb';
import { checkLead } from '../engine/tgmEngine';
import { fetchLiveSignals, fetchCloudLeads, triggerCloudCron } from '../engine/tgmTelegram';
import { buildRanking } from '../engine/tgmStats';
import './TgmPage.css';

const COMMON_ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT'];

const TG_LIVE_INTERVAL_MS = 180000; // תדירות מצב חי מטלגרם (3 דק׳ — הערוצים מתעדכנים לאט)

const EMPTY_FORM = {
  provider: LIVE_PROVIDERS[0],
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
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TgmPage({ navigate }) {
  const [leads, setLeads] = useState([]);
  const leadsRef = useRef([]);
  leadsRef.current = leads; // עותק עדכני לצורך בדיקת כפילויות במצב חי
  const [form, setForm] = useState({ ...EMPTY_FORM, date: defaultDateLocal() });
  const [formError, setFormError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [scanning, setScanning] = useState(false); // אינדיקציית עיסוק במשיכה חיה
  const [liveMode, setLiveMode] = useState(false);
  const [cloudMode, setCloudMode] = useState(false); // ענן מחובר (Redis ב-Vercel)
  const [lastCron, setLastCron] = useState(null);

  const scanningRef = useRef(false);    // מונע משיכות חופפות
  const autoStartedRef = useRef(false); // משיכה ראשונה פעם אחת בטעינה
  const cloudModeRef = useRef(false);

  const reload = useCallback(async () => {
    const all = await getAllLeads();
    setLeads(all);
    return all;
  }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── בדיקה חוזרת של ליד בודד ──
  const runCheck = useCallback(async (lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'checking', error: null } : l)));
    try {
      const r = await checkLead(lead);
      const updated = { ...lead, status: r.result, reason: r.reason, exitPrice: r.exitPrice, closedAtMs: r.closedAtMs, checkedAt: Date.now(), error: null };
      await saveLead(updated);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch (e) {
      const errored = { ...lead, status: 'error', error: e.message, checkedAt: Date.now() };
      await saveLead(errored);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? errored : l)));
    }
  }, []);

  // ── קריאת לידים מהענן (מצב ענן) ──
  const refreshFromCloud = useCallback(async (trigger = false) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    try {
      if (trigger) {
        setStatusMsg('☁️ מפעיל סבב משיכה בענן…');
        await triggerCloudCron().catch(() => {});
      }
      const { leads: cloudLeads = [], lastCron: lc } = await fetchCloudLeads();
      cloudLeads.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
      setLeads(cloudLeads);
      setLastCron(lc || null);
      setStatusMsg(`☁️ מצב ענן — ${cloudLeads.length} לידים נשמרים בענן (ממשיך לרוץ גם כשהמחשב סגור)`);
    } catch (e) {
      setStatusMsg('שגיאה בקריאה מהענן: ' + e.message);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, []);

  // ── משיכת לידים מטלגרם + בדיקה (מצב מקומי, ללא ענן) ──
  const ingestLocal = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setStatusMsg('📡 מושך לידים חיים מערוצי טלגרם…');
    try {
      const { signals = [], errors = [] } = await fetchLiveSignals('all');
      const seenPost = new Set(leadsRef.current.map((l) => l.postId).filter(Boolean));
      const idKey = (l) => `${l.provider}|${l.asset}|${l.entry}|${l.dateMs}`;
      const seenId = new Set(leadsRef.current.map(idKey));

      const fresh = [];
      for (const s of signals) {
        if (s.postId && seenPost.has(s.postId)) continue;
        const lead = {
          id: newLeadId(), provider: s.provider, asset: s.asset, direction: s.direction,
          entry: s.entry, tp: s.tp, sl: s.sl, dateMs: s.dateMs,
          postId: s.postId, source: 'telegram', status: 'pending', createdAt: Date.now(),
        };
        if (seenId.has(idKey(lead))) continue;
        seenId.add(idKey(lead));
        fresh.push(lead);
      }

      for (const lead of fresh) {
        await saveLead(lead);
        setLeads((prev) => [lead, ...prev]);
        await runCheck(lead);
      }

      const errNote = errors.length ? ` · ערוצים שנכשלו: ${errors.map((e) => e.channel).join(', ')}` : '';
      setStatusMsg(`📡 נמשכו ${signals.length} סיגנלים מטלגרם · ${fresh.length} חדשים נוספו ונבדקו${errNote}`);
    } catch (e) {
      setStatusMsg('שגיאה במשיכה מטלגרם: ' + e.message);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [runCheck]);

  // משיכה/רענון — בוחר ענן או מקומי לפי המצב.
  const ingestFromTelegram = useCallback(() => {
    return cloudModeRef.current ? refreshFromCloud(true) : ingestLocal();
  }, [refreshFromCloud, ingestLocal]);

  // טעינה ראשונית: אם הענן מחובר — קורא ממנו (עמיד, רץ 24/7).
  // אחרת — מצב מקומי (IndexedDB + משיכה מהדפדפן).
  useEffect(() => {
    (async () => {
      try {
        const cloud = await fetchCloudLeads().catch(() => ({ configured: false }));
        if (cloud.configured) {
          cloudModeRef.current = true;
          setCloudMode(true);
          const cl = (cloud.leads || []).sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
          setLeads(cl);
          setLastCron(cloud.lastCron || null);
          setStatusMsg(`☁️ מצב ענן — ${cl.length} לידים נשמרים בענן (ממשיך לרוץ גם כשהמחשב סגור)`);
          return;
        }
        // ── מצב מקומי ──
        cloudModeRef.current = false;
        setCloudMode(false);
        let all = await reload();
        const stale = all.filter((l) => l.auto || l.demo || !LIVE_PROVIDERS.includes(l.provider));
        if (stale.length) {
          for (const l of stale) await deleteLead(l.id);
          all = await reload();
        }
        if (!autoStartedRef.current) {
          autoStartedRef.current = true;
          ingestLocal();
        }
      } catch (e) {
        setStatusMsg('שגיאה בטעינת הנתונים: ' + e.message);
      }
    })();
  }, [reload, ingestLocal]);

  // מצב חי: רענון תקופתי (ענן → קריאה; מקומי → משיכה), ללא התערבות.
  useEffect(() => {
    if (!liveMode) return;
    const tick = () => (cloudModeRef.current ? refreshFromCloud(false) : ingestLocal());
    const id = setInterval(tick, TG_LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [liveMode, refreshFromCloud, ingestLocal]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    const entry = parseFloat(form.entry);
    const tp = parseFloat(form.tp);
    const sl = parseFloat(form.sl);
    const dateMs = form.date ? new Date(form.date).getTime() : NaN;

    if (!form.asset.trim()) return setFormError('יש להזין נכס (לדוגמה BTC/USDT)');
    if (!Number.isFinite(entry) || !Number.isFinite(tp) || !Number.isFinite(sl)) return setFormError('יש להזין מחירי כניסה, יעד וסטופ תקינים');
    if (!Number.isFinite(dateMs)) return setFormError('יש לבחור תאריך');
    if (dateMs > Date.now()) return setFormError('תאריך הליד לא יכול להיות בעתיד');
    if (form.direction === 'LONG' && !(tp > entry && sl < entry)) return setFormError('ב-LONG: היעד (TP) חייב להיות מעל הכניסה והסטופ (SL) מתחתיה');
    if (form.direction === 'SHORT' && !(tp < entry && sl > entry)) return setFormError('ב-SHORT: היעד (TP) חייב להיות מתחת לכניסה והסטופ (SL) מעליה');

    const lead = {
      id: newLeadId(), provider: form.provider, asset: form.asset.trim().toUpperCase(),
      direction: form.direction, entry, tp, sl, dateMs, status: 'pending', createdAt: Date.now(),
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

  const handleDelete = async (id) => {
    await deleteLead(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClearAll = async () => {
    if (cloudModeRef.current) {
      setStatusMsg('☁️ במצב ענן הנתונים נשמרים בענן ואינם נמחקים מכאן — זו ההיסטוריה ארוכת-הטווח של הספקים');
      return;
    }
    if (!window.confirm('למחוק את כל הלידים? פעולה זו אינה הפיכה.')) return;
    setLiveMode(false);
    await clearAllLeads();
    setLeads([]);
    autoStartedRef.current = true; // לא למשוך מטלגרם מחדש אוטומטית לאחר ניקוי יזום
    setStatusMsg('כל הלידים נמחקו');
  };

  const ranking = useMemo(() => buildRanking(leads), [leads]);
  const checkedCount = leads.filter((l) => l.status === 'win' || l.status === 'loss').length;
  const openCount = leads.filter((l) => l.status === 'open').length;

  return (
    <div className="tgm-wrap" dir="rtl">
      <RobotNavTabs currentPage="tgm" navigate={navigate} />

      {/* Header */}
      <div className="tgm-header">
        <div>
          <h2 className="tgm-title">🛰️ TGM — סורק לידים</h2>
          <p className="tgm-sub">מצב חי — משיכת לידים אמיתיים מערוצי טלגרם חינמיים ובדיקתם מול Binance API</p>
        </div>
        <div className={`tgm-badge ${scanning ? 'tgm-badge--live' : ''}`}>
          {scanning ? '⏳ פעיל…' : cloudMode ? '☁️ ענן' : liveMode ? '🔴 מצב חי' : '🟢 מוכן'}
        </div>
      </div>

      {/* בקרת מצב חי */}
      <div className="tgm-auto-bar">
        <button className="tgm-btn tgm-btn--add" onClick={() => ingestFromTelegram()} disabled={scanning}>
          {cloudMode ? '☁️ רענן מהענן עכשיו' : '📡 משוך לידים מטלגרם עכשיו'}
        </button>
        <label className={`tgm-live-toggle ${liveMode ? 'tgm-live-toggle--on' : ''}`}>
          <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
          <span>🔴 רענון אוטומטי כל 3 דק׳</span>
        </label>
        <button className="tgm-btn tgm-btn--clear" onClick={handleClearAll} disabled={scanning}>🗑️ נקה הכל</button>
      </div>

      {/* הסבר מקור הנתונים */}
      <div className="tgm-source-note">
        {cloudMode ? (
          <>☁️ <b>מצב ענן פעיל</b> — שרת בענן מושך את הערוצים, בודק מול Binance ושומר את כל ההיסטוריה <b>גם כשהמחשב סגור</b>.
          לידים פתוחים נבדקים מחדש אוטומטית עד הכרעה, כך שבעוד חודש יהיה דירוג אמין לכל ספק.
          {lastCron && <> · עדכון אחרון: {new Date(lastCron).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</>}</>
        ) : (
          <>📡 מצב מקומי — לידים אמיתיים מערוצי טלגרם חינמיים, נבדקים מול Binance. נשמר בדפדפן זה בלבד.
          (מצב ענן יופעל אוטומטית לאחר פריסה ל-Vercel עם Redis — אז הנתונים יישמרו בענן וימשיכו לרוץ גם כשהמחשב סגור.)</>
        )}
      </div>

      {statusMsg && <div className="tgm-status">{statusMsg}</div>}

      {/* ── טבלת דירוג ── */}
      <div className="tgm-section-title">🏆 טבלת דירוג ספקים</div>
      <div className="tgm-table-card">
        <table className="tgm-table">
          <thead>
            <tr><th>דירוג</th><th>שם ספק</th><th>מספר טריידים</th><th>אחוז הצלחה</th></tr>
          </thead>
          <tbody>
            {ranking.map((row) => {
              const sr = row.trades > 0 ? row.successRate : 0;
              const pctColor = sr >= 60 ? '#4ade80' : sr >= 45 ? '#D4AF37' : '#ef4444';
              return (
                <tr key={row.provider} className={row.eligible ? '' : 'tgm-row--insufficient'}>
                  <td className="tgm-rank-cell">
                    {row.eligible ? <span className="tgm-rank-medal">#{row.rank}</span> : <span className="tgm-rank-dash">—</span>}
                  </td>
                  <td className="tgm-prov-cell">{row.provider}</td>
                  <td>
                    {row.trades}
                    {!row.eligible && (
                      <span className="tgm-insufficient-tag" title={`נדרשים לפחות ${MIN_TRADES_FOR_RANK} טריידים לדירוג רשמי`}>מדגם לא מספיק</span>
                    )}
                  </td>
                  <td>
                    {row.trades > 0 ? <span style={{ color: pctColor, fontWeight: 800 }}>{sr.toFixed(1)}%</span> : <span className="tgm-rank-dash">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="tgm-table-foot">
          סה״כ {checkedCount} טריידים שהוכרעו · {openCount} פתוחים · דירוג רשמי מ-{MIN_TRADES_FOR_RANK} טריידים ומעלה
        </div>
      </div>

      {/* ── הזנה ידנית (אופציונלי) ── */}
      <button className="tgm-manual-toggle" onClick={() => setShowManual((v) => !v)}>
        {showManual ? '▾' : '▸'} הזנת ליד ידנית (אופציונלי)
      </button>
      {showManual && (
        <form className="tgm-form" onSubmit={handleAdd}>
          <div className="tgm-form-grid">
            <label className="tgm-field"><span>ספק</span>
              <select value={form.provider} onChange={(e) => setField('provider', e.target.value)}>
                {LIVE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="tgm-field"><span>נכס</span>
              <input list="tgm-assets" value={form.asset} onChange={(e) => setField('asset', e.target.value)} placeholder="BTC/USDT" />
              <datalist id="tgm-assets">{COMMON_ASSETS.map((a) => <option key={a} value={a} />)}</datalist>
            </label>
            <label className="tgm-field"><span>כיוון</span>
              <div className="tgm-dir-toggle">
                <button type="button" className={`tgm-dir-btn ${form.direction === 'LONG' ? 'tgm-dir-btn--long' : ''}`} onClick={() => setField('direction', 'LONG')}>LONG ▲</button>
                <button type="button" className={`tgm-dir-btn ${form.direction === 'SHORT' ? 'tgm-dir-btn--short' : ''}`} onClick={() => setField('direction', 'SHORT')}>SHORT ▼</button>
              </div>
            </label>
            <label className="tgm-field"><span>מחיר כניסה (Entry)</span>
              <input type="number" step="any" value={form.entry} onChange={(e) => setField('entry', e.target.value)} placeholder="0.00" />
            </label>
            <label className="tgm-field"><span>יעד (TP)</span>
              <input type="number" step="any" value={form.tp} onChange={(e) => setField('tp', e.target.value)} placeholder="0.00" />
            </label>
            <label className="tgm-field"><span>סטופ (SL)</span>
              <input type="number" step="any" value={form.sl} onChange={(e) => setField('sl', e.target.value)} placeholder="0.00" />
            </label>
            <label className="tgm-field"><span>תאריך הליד</span>
              <input type="datetime-local" value={form.date} onChange={(e) => setField('date', e.target.value)} max={defaultDateLocal()} />
            </label>
          </div>
          {formError && <div className="tgm-form-error">⚠️ {formError}</div>}
          <div className="tgm-form-actions">
            <button type="submit" className="tgm-btn tgm-btn--add" disabled={busy}>➕ הוסף ובדוק ליד</button>
          </div>
        </form>
      )}

      {/* ── רשימת לידים ── */}
      <div className="tgm-section-title">📋 לידים ({leads.length})</div>
      <div className="tgm-leads">
        {leads.length === 0 && !scanning && (
          <div className="tgm-empty">אין לידים עדיין — לחץ "משוך לידים מטלגרם עכשיו".</div>
        )}
        {leads.slice(0, 120).map((l) => (
          <div key={l.id} className={`tgm-lead-card tgm-lead--${l.status}`}>
            <div className="tgm-lead-main">
              <span className="tgm-lead-prov">{l.provider}</span>
              {l.source === 'telegram' && <span className="tgm-lead-src" title="נמשך מערוץ טלגרם חי">📡</span>}
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
                <button className="tgm-mini-btn" onClick={() => runCheck(l)} disabled={scanning} title="בדוק מחדש">🔄</button>
                <button className="tgm-mini-btn tgm-mini-btn--del" onClick={() => handleDelete(l.id)} disabled={scanning} title="מחק">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {leads.length > 120 && <div className="tgm-more-note">מוצגים 120 לידים אחרונים מתוך {leads.length}. כל הלידים נכללים בטבלת הדירוג.</div>}

      {/* Disclaimer */}
      <div className="tgm-disclaimer">⚠️ מידע ומחקר בלבד, לא ייעוץ השקעות.</div>
    </div>
  );
}

function StatusBadge({ lead }) {
  const { status, reason } = lead;
  if (status === 'win') return <span className="tgm-result tgm-result--win">✓ ניצחון{reason ? ` · ${reason === 'TIME' ? 'מחיר נוכחי' : reason}` : ''}</span>;
  if (status === 'loss') return <span className="tgm-result tgm-result--loss">✕ הפסד{reason ? ` · ${reason === 'TIME' ? 'מחיר נוכחי' : reason}` : ''}</span>;
  if (status === 'open') return <span className="tgm-result tgm-result--open" title="טרם נגע ב-TP/SL — נספר רק לאחר הכרעה">◷ פתוח</span>;
  if (status === 'checking') return <span className="tgm-result tgm-result--checking">⏳ בודק…</span>;
  if (status === 'error') return <span className="tgm-result tgm-result--error" title={lead.error}>⚠️ שגיאה</span>;
  return <span className="tgm-result tgm-result--pending">• ממתין לבדיקה</span>;
}
