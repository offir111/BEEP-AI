/**
 * AlertsPage.jsx — chart fills page, dialog floats on top (like S.T.B screenshot)
 *
 * Layout:
 *   • AlertChart (Lightweight Charts) fills the entire page background
 *   • Alert price lines drawn EXACTLY at their price levels on the chart
 *   • QuickAlert dialog floats as a semi-transparent overlay on top
 *   • Closing dialog → chart stays visible + reopen button
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

      {/* ── Chart fills the entire background ── */}
      <div className="ap-chart">
        <AlertChart symbol={chartSymbol} alerts={symAlerts} />

        {/* Reopen button — visible after dialog is closed */}
        {!showDialog && (
          <button className="ap-reopen" onClick={() => setShowDialog(true)}>
            🔔 פתח התראות
            {symAlerts.length > 0 && (
              <span className="ap-reopen-badge">{symAlerts.length}</span>
            )}
          </button>
        )}
      </div>

      {/* ── Dialog overlay (not embedded → semi-transparent backdrop) ── */}
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
