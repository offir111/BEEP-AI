// TGM · Paper client — קריאת ה-track record החי מהשרת (/api/tgm-paper).
// אם השרת מחזיר configured:false (אין Redis, למשל בדב מקומי) — מחזיר אותו כמות שהוא
// והלקוח מציג הסבר איך להפעיל (deploy + Upstash + cron).

import { apiUrl } from '../utils/apiBase';

export async function fetchPaper() {
  try {
    const res = await fetch(apiUrl('/api/tgm-paper'), { headers: { Accept: 'application/json' } });
    if (!res.ok) return { configured: false, reason: `שגיאת שרת ${res.status}` };
    return await res.json();
  } catch (e) {
    return { configured: false, reason: `אין חיבור לשרת: ${e.message}` };
  }
}

// הפעלה ידנית של סבב cron (פתיחה/עדכון מיידי) — שימושי לבדיקה/התחלת מעקב.
export async function triggerPaperCron(force = false) {
  try {
    const res = await fetch(apiUrl(`/api/tgm-paper-cron${force ? '?force=1' : ''}`), { headers: { Accept: 'application/json' } });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
