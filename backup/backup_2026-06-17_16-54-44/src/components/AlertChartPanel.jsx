/**
 * AlertChartPanel — עוטף את AlertChart, מחבר אוטומטית את ההתראות מה-Context,
 * ומוסיף שורת כפתורי זמן (timeframes) מעל הגרף. שימוש בכל מקום שנפתח גרף:
 *   <AlertChartPanel symbol="BTC" isCrypto defaultTf="1h" />
 */
import { useState } from 'react';
import { useAlerts } from '../context/AlertsContext';
import AlertChart from './AlertChart';
import './AlertChartPanel.css';

// כפתורי זמן — בלי "1 דקה", עם "1M" (חודשי) ו-"1Y" (שנה של נרות יומיים)
export const TIMEFRAMES = [
  { id: '5m',  bin: '5m',  limit: 200 },
  { id: '15m', bin: '15m', limit: 200 },
  { id: '1h',  bin: '1h',  limit: 200 },
  { id: '4h',  bin: '4h',  limit: 200 },
  { id: '1D',  bin: '1d',  limit: 200 },
  { id: '1W',  bin: '1w',  limit: 200 },
  { id: '1M',  bin: '1M',  limit: 200 },
  { id: '1Y',  bin: '1d',  limit: 365 },
];

export default function AlertChartPanel({ symbol, isCrypto = true, defaultTf = '1D', cgId }) {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const [tf, setTf] = useState(defaultTf);
  const cur = TIMEFRAMES.find(t => t.id === tf) || TIMEFRAMES[4];

  const short = String(symbol || '').toUpperCase();
  const symAlerts = alerts.filter(a => !a.triggered && a.symbol === short);

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
      </div>
      <div className="acp-chart">
        <AlertChart
          symbol={short}
          isCrypto={isCrypto}
          interval={cur.bin}
          limit={cur.limit}
          cgId={cgId}
          alerts={symAlerts}
          onAlertPriceChange={(id, price) => editAlert(id, { target: price })}
          onAlertRemove={removeAlert}
        />
      </div>
    </div>
  );
}
