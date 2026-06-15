// TGM — צד-לקוח: משיכת סיגנלים חיים מערוצי טלגרם דרך נקודת הקצה בצד-שרת
// (הדפדפן חסום מ-t.me ב-CORS, לכן עוברים דרך /api/tgm-telegram).

export async function fetchLiveSignals(channel = 'all') {
  const r = await fetch(`/api/tgm-telegram?channel=${encodeURIComponent(channel)}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`שרת טלגרם החזיר ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d; // { signals, errors, channels }
}
