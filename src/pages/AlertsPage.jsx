/**
 * AlertsPage.jsx
 *
 * Layout:
 *   • Lightweight Charts fills the page (exact alert price lines)
 *   • QuickAlert dialog floats as a semi-transparent overlay
 *   • Closing the dialog leaves the chart + lines visible
 *   • "פתח התראות" button reopens the dialog
 */
import { useState, useEffect, useMemo } from 'react';
import { useAlerts, fetchLivePrice } from '../context/AlertsContext';
import AlertChart from '../components/AlertChart';
import QuickAlert from '../components/QuickAlert';
import './AlertsPage.css';

export default function AlertsPage() {
  const { alerts, markSeen } = useAlerts();

  const [chartSymbol, setChartSymbol] = useState('BTC');
  const [livePrice,   setLivePrice]   = useState(null);
  const [showDialog,  setShowDialog]  = useState(true);

  // Mark fired alerts seen on page open
  useEffect(() => { markSeen(); }, [markSeen]);

  // Fetch live price for QuickAlert display
  useEffect(() => {
    setLivePrice(null);
    let cancelled = false;
    fetchLivePrice(chartSymbol)
      .then(p => { if (!cancelled && p) setLivePrice(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chartSymbol]);

  // Stable reference — only changes when alerts/symbol actually change
  const symAlerts = useMemo(
    () => alerts.filter(a => !a.triggered && a.symbol === chartSymbol.toUpperCase()),
    [alerts, chartSymbol]
  );

  return (
    <div className="ap-root">

      {/* ── Lightweight Charts + exact price lines ── */}
      <div className="ap-chart">
        <AlertChart
          symbol={chartSymbol}
          alerts={symAlerts}
        />

        {/* Reopen button when dialog is closed */}
        {!showDialog && (
          <button className="ap-reopen" onClick={() => setShowDialog(true)}>
            🔔 פתח התראות
            {symAlerts.length > 0 && (
              <span className="ap-reopen-badge">{symAlerts.length}</span>
            )}
          </button>
        )}
      </div>

      {/* ── Alerts dialog overlay ── */}
      {showDialog && (
        <QuickAlert
          symbol={chartSymbol}
          currentPrice={livePrice}
          onClose={() => setShowDialog(false)}
          onSymbolChange={setChartSymbol}
        />
      )}
    </div>
  );
}
