/**
 * AlertChartPanel — עוטף את AlertChart, מחבר אוטומטית את ההתראות מה-Context,
 * ומוסיף שורת כפתורי זמן (timeframes) מעל הגרף. שימוש בכל מקום שנפתח גרף:
 *   <AlertChartPanel symbol="BTC" isCrypto defaultTf="1h" />
 *
 * ניווט בין מניות (opt-in, תאימות לאחור): אם מסופק `navList` (מערך
 * [{ symbol, pct, isCrypto?, cgId?, label? }]) — מוצגים שני חיצים ◄ ► שמדלגים
 * מעגלית בין המניות של הרשימה לתוך אותו גרף, ומוצג האחוז של המניה הנוכחית.
 * בלי navList — התנהגות מקורית לחלוטין (בלי חיצים, בלי אחוז).
 */
import { useState, useEffect } from 'react';
import { useAlerts } from '../context/AlertsContext';
import AlertChart from './AlertChart';
import './AlertChartPanel.css';

// כפתורי זמן — בלי "1 דקה", עם 1M/1Y ובנוסף 5Y (5 שנים) ו-ALL (כל ההיסטוריה).
// 5Y = נרות שבועיים בטווח 5 שנים (Yahoo range=5y) · ALL = נרות חודשיים בטווח max.
export const TIMEFRAMES = [
  { id: '5m',  bin: '5m',  limit: 200 },
  { id: '15m', bin: '15m', limit: 200 },
  { id: '1h',  bin: '1h',  limit: 200 },
  { id: '4h',  bin: '4h',  limit: 200 },
  { id: '1D',  bin: '1d',  limit: 200 },
  { id: '1W',  bin: '1w',  limit: 200 },
  { id: '1M',  bin: '1M',  limit: 200 },
  { id: '1Y',  bin: '1d',  limit: 365 },
  { id: '5Y',  bin: '1w',  limit: 300 },
  { id: 'ALL', bin: '1M',  limit: 1200 },
];

export default function AlertChartPanel({
  symbol, isCrypto = true, defaultTf = '1D', cgId,
  navList = null, navStartIndex = 0, navPctLabel = '',
}) {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const [tf, setTf] = useState(defaultTf);
  const cur = TIMEFRAMES.find(t => t.id === tf) || TIMEFRAMES[4];

  // ── ניווט בין מניות (רק אם סופקה רשימה) ──
  const nav = Array.isArray(navList) && navList.length ? navList : null;
  const clampIdx = (i) => Math.min(Math.max(i, 0), (nav?.length || 1) - 1);
  const [idx, setIdx] = useState(nav ? clampIdx(navStartIndex) : 0);
  // אתחול מחדש כשנפתח גרף חדש (רשימה/אינדקס שונים)
  useEffect(() => { if (nav) setIdx(clampIdx(navStartIndex)); /* eslint-disable-next-line */ }, [navStartIndex, navList]);

  const active = nav ? nav[clampIdx(idx)] : null;
  const activeSymbol   = active ? active.symbol : symbol;
  const activeIsCrypto = active && active.isCrypto != null ? active.isCrypto : isCrypto;
  const activeCg       = active && active.cgId != null ? active.cgId : cgId;

  const short = String(activeSymbol || '').toUpperCase();
  const symAlerts = alerts.filter(a => !a.triggered && a.symbol === short);

  const step = (d) => { if (nav) setIdx(i => (clampIdx(i) + d + nav.length) % nav.length); };
  const pctNum = active && typeof active.pct === 'number' && Number.isFinite(active.pct) ? active.pct : null;

  return (
    <div className="acp-wrap">
      <div className="acp-tf-row">
        {TIMEFRAMES.map(t => (
          <button
            key={t.id}
            className={`acp-tf${tf === t.id ? ' acp-tf--on' : ''}`}
            onClick={() => setTf(t.id)}
          >{t.id}</button>
        ))}
        {/* חיצי ניווט — בקצה השמאלי של שורת הטווחים, מוגדלים (opt-in) */}
        {nav && (
          <span className="acp-nav">
            <button className="acp-nav-btn" onClick={() => step(-1)} aria-label="מניה קודמת" title="הקודם">‹</button>
            <button className="acp-nav-btn" onClick={() => step(1)}  aria-label="מניה הבאה"  title="הבא">›</button>
            <span className="acp-nav-pos">{clampIdx(idx) + 1}/{nav.length}</span>
          </span>
        )}
      </div>
      <div className="acp-chart">
        <AlertChart
          symbol={short}
          isCrypto={activeIsCrypto}
          interval={cur.bin}
          limit={cur.limit}
          cgId={activeCg}
          alerts={symAlerts}
          changePct={pctNum}
          marketCap={active && Number.isFinite(active.mcap) ? active.mcap : null}
          sector={active ? (active.sector || null) : null}
          newsEnabled={!!nav}
          onAlertPriceChange={(id, price) => editAlert(id, { target: price })}
          onAlertRemove={removeAlert}
        />
      </div>
    </div>
  );
}
