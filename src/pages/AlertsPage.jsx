/**
 * AlertsPage.jsx
 *
 * Layout (matches news tab size):
 *   • QuickAlert dialog at the top (inline, not overlay)
 *   • AlertChart below — same sizing as the news widget (600px, border)
 *   • Closing dialog shows a reopen button above the chart
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

  // Mark fired alerts as seen on page open
  useEffect(() => { markSeen(); }, [markSeen]);

  // Live price for QuickAlert display
  useEffect(() => {
    setLivePrice(null);
    let cancelled = false;
    fetchLivePrice(chartSymbol)
      .then(p => { if (!cancelled && p) setLivePrice(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chartSymbol]);

  // Stable array — only recomputes when alerts / symbol change
  const symAlerts = useMemo(
    () => alerts.filter(a => !a.triggered && a.symbol === chartSymbol.toUpperCase()),
    [alerts, chartSymbol]
  );

  return (
    <div className="ap-root">

      {/* ── Dialog (inline above chart) ── */}
      {showDialog ? (
        <QuickAlert
          embedded
          symbol={chartSymbol}
          currentPrice={livePrice}
          onClose={() => setShowDialog(false)}
          onSymbolChange={setChartSymbol}
        />
      ) : (
        <div className="ap-reopen-bar">
          <button className="ap-reopen" onClick={() => setShowDialog(true)}>
            🔔 פתח התראות
            {symAlerts.length > 0 && (
              <span className="ap-reopen-badge">{symAlerts.length}</span>
            )}
          </button>
        </div>
      )}

      {/* ── Chart — same size/style as news tab ── */}
      <div className="ap-chart">
        <AlertChart
          symbol={chartSymbol}
          alerts={symAlerts}
        />
      </div>

    </div>
  );
}
