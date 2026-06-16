// TGM — צד-לקוח: משיכת סיגנלים חיים מערוצי טלגרם דרך נקודת הקצה בצד-שרת
// (הדפדפן חסום מ-t.me ב-CORS, לכן עוברים דרך /api/tgm-telegram).
import { apiUrl } from '../utils/apiBase';

export async function fetchLiveSignals(channel = 'all') {
  const r = await fetch(apiUrl(`/api/tgm-telegram?channel=${encodeURIComponent(channel)}`), {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`שרת טלגרם החזיר ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d; // { signals, errors, channels }
}

// ── מצב ענן: קריאת לידים שנשמרו בענן (Redis), ע"י cron שרץ 24/7 ──
export async function fetchCloudLeads() {
  const r = await fetch(apiUrl('/api/tgm-leads'), { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`ענן החזיר ${r.status}`);
  return r.json(); // { configured, leads, lastCron }
}

// הפעלה ידנית של סבב ה-cron בענן (משיכה+בדיקה מיידית).
export async function triggerCloudCron() {
  const r = await fetch(apiUrl('/api/tgm-cron'), { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`cron החזיר ${r.status}`);
  return r.json();
}
