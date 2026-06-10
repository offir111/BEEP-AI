/**
 * AlertsPage.jsx — renders the S.T.B alerts dialog embedded in the page
 * (no overlay; same component as the charts-page modal, embedded=true mode)
 */
import { useEffect } from 'react';
import { useAlerts } from '../context/AlertsContext';
import QuickAlert from '../components/QuickAlert';

export default function AlertsPage() {
  const { markSeen } = useAlerts();

  // Mark fired alerts as seen when page opens
  useEffect(() => { markSeen(); }, [markSeen]);

  return (
    <QuickAlert
      embedded
      onClose={null}
    />
  );
}
