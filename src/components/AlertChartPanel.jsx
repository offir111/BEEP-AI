/**
 * AlertChartPanel — עוטף את AlertChart ומחבר אוטומטית את ההתראות מה-Context.
 * שימוש בכל מקום שנפתח גרף: <AlertChartPanel symbol="BTC" isCrypto interval="1h" />
 * כך כל גרף באפליקציה מקבל את אותו גרף קנבס + קווי ההתראה הנגררים (זהה לאם).
 */
import { useAlerts } from '../context/AlertsContext';
import AlertChart from './AlertChart';

export default function AlertChartPanel({ symbol, isCrypto = true, interval = '1d', cgId }) {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const short = String(symbol || '').toUpperCase();
  const symAlerts = alerts.filter(a => !a.triggered && a.symbol === short);

  return (
    <AlertChart
      symbol={short}
      isCrypto={isCrypto}
      interval={interval}
      cgId={cgId}
      alerts={symAlerts}
      onAlertPriceChange={(id, price) => editAlert(id, { target: price })}
      onAlertRemove={removeAlert}
    />
  );
}
