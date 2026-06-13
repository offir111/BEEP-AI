// /api/alerts-register.js — Stores push subscription + alerts in Upstash Redis
// Called by frontend on app load and whenever alerts change
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'redis_not_configured' });

  const { deviceId, subscription, fcmToken, alerts } = req.body || {};
  if (!deviceId || (!subscription && !fcmToken)) return res.status(400).json({ error: 'missing_fields' });

  // Only keep active, non-triggered alerts
  const activeAlerts = (alerts || []).filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));

  const payload = JSON.stringify({ subscription: subscription || null, fcmToken: fcmToken || null, alerts: activeAlerts, updatedAt: Date.now() });

  // Store in Upstash Redis hash — TTL 30 days (auto-cleanup inactive devices)
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['HSET', 'beepai:subscriptions', deviceId, payload]),
  });

  if (!r.ok) return res.status(500).json({ error: 'redis_write_failed' });
  res.json({ ok: true, active: activeAlerts.length });
}
