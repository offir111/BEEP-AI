/**
 * AlertsPage.jsx
 *
 * Layout — matches news-widget size:
 *   • Bounded chart box (600px h, max-width 900px, border) — same as news tab
 *   • Lightweight Charts fills the box (exact price lines)
 *   • QuickAlert floats as overlay INSIDE the box (contained, not full-viewport)
 */
import { useState, useEffect, useMemo } from 'react';
import { useAlerts, fetchLivePrice } from '../context/AlertsContext';
import AlertChart from '../components/AlertChart';
import QuickAlert from '../components/QuickAlert';
import './AlertsPage.css';

export default function AlertsPage() {
  const { alerts, markSeen, editAlert } = useAlerts();

  const [chartSymbol, setChartSymbol] = useState('BTC');
  const [livePrice,   setLivePrice]   = useState(null);
  const [showDialog,  setShowDialog]  = useState(true);

  useEffect(() => { markSeen(); }, [markSeen]);

  useEffect(() => {
    setLivePrice(null);
    let cancelled = false;
    fetchLivePrice(chartSymbol)
      .then(p => { if (!cancelled && p) setLivePrice(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chartSymbol]);

  const symAlerts = useMemo(
    () => alerts.filter(a => !a.triggered && a.symbol === chartSymbol.toUpperCase()),
    [alerts, chartSymbol]
  );

  return (
    <div className="ap-root">

      {/* ── Bounded chart box (news-widget size) with dialog overlay inside ── */}
      <div className="ap-chart-box">

        {/* Lightweight Charts — exact price lines */}
        <AlertChart
          symbol={chartSymbol}
          alerts={symAlerts}
          onAlertPriceChange={(id, price) => editAlert(id, { target: price })}
        />

        {/* Dialog floats inside the chart box */}
        {showDialog && (
          <QuickAlert
            contained
            symbol={chartSymbol}
            currentPrice={livePrice}
            onClose={() => setShowDialog(false)}
            onSymbolChange={setChartSymbol}
          />
        )}

        {/* Reopen button — bottom-center of chart box */}
        {!showDialog && (
          <button className="ap-reopen" onClick={() => setShowDialog(true)}>
            🔔 פתח התראות
            {symAlerts.length > 0 && (
              <span className="ap-reopen-badge">{symAlerts.length}</span>
            )}
          </button>
        )}

      </div>
    </div>
  );
}
