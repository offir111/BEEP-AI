// /api/test-fcm.js — Diagnostic: send a real FCM push to the stored phone token
// Call: GET /api/test-fcm  → returns exact firebase init + send result
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  return d.result;
}

export default async function handler(req, res) {
  const diag = { steps: [] };

  // 1. Check env var presence
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  diag.steps.push({ step: 'env_present', ok: !!raw, length: raw?.length || 0 });
  if (!raw) return res.status(200).json(diag);

  // 2. Parse JSON
  let creds;
  try {
    creds = JSON.parse(raw.replace(/^﻿/, '').trim());
    diag.steps.push({ step: 'json_parse', ok: true, project_id: creds.project_id, client_email: creds.client_email, has_private_key: !!creds.private_key, pk_has_newlines: creds.private_key?.includes('\n') });
  } catch (e) {
    diag.steps.push({ step: 'json_parse', ok: false, error: e.message });
    return res.status(200).json(diag);
  }

  // 3. Init firebase-admin (modular ESM API)
  let messaging;
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(creds) });
    messaging = getMessaging(app);
    diag.steps.push({ step: 'firebase_init', ok: true });
  } catch (e) {
    diag.steps.push({ step: 'firebase_init', ok: false, error: e.message, stack: e.stack?.split('\n').slice(0,3) });
    return res.status(200).json(diag);
  }

  // 4. Get the phone's FCM token from Redis
  const all = await redis(['HGETALL', 'beepai:subscriptions']);
  let fcmToken = null, deviceId = null;
  for (let i = 0; i < (all?.length || 0); i += 2) {
    try {
      const d = JSON.parse(all[i + 1]);
      if (d.fcmToken) { fcmToken = d.fcmToken; deviceId = all[i]; break; }
    } catch {}
  }
  diag.steps.push({ step: 'find_token', ok: !!fcmToken, deviceId, token_preview: fcmToken?.slice(0, 25) });
  if (!fcmToken) return res.status(200).json(diag);

  // 5. Send a real test FCM
  try {
    const id = await messaging.send({
      token: fcmToken,
      notification: { title: '🔔 בדיקת BEEP AI', body: 'אם אתה רואה את זה — FCM עובד!' },
      android: { priority: 'high', notification: { channelId: 'beepai_alerts', sound: 'default' } },
    });
    diag.steps.push({ step: 'fcm_send', ok: true, messageId: id });
  } catch (e) {
    diag.steps.push({ step: 'fcm_send', ok: false, code: e.code, error: e.message });
  }

  res.status(200).json(diag);
}
