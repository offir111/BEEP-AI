// /api/cron-push.js — Runs every minute via Vercel Cron / QStash
// Sends Web Push (browser) + FCM (Android APK) notifications when app is closed
import webpush from 'web-push';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// ── Firebase Admin (FCM for Android APK) — modular ESM API ───
let _messaging = null;
async function getFCMApp() {
  if (_messaging) return _messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // Strip UTF-8 BOM / leading whitespace that Vercel may prepend to env vars
    const creds = JSON.parse(raw.replace(/^﻿/, '').trim());
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(creds) });
    _messaging = getMessaging(app);
    return _messaging;
  } catch (e) {
    console.error('[cron-push] Firebase init error:', e.message);
    return null;
  }
}

async function sendFCM(messaging, fcmToken, title, body, tag) {
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      android: { priority: 'high', notification: { tag, sound: 'default', channelId: 'beepai_alerts' } },
    });
    return true;
  } catch (e) {
    console.error('[cron-push] FCM error:', e.code, e.message);
    // Remove invalid tokens
    if (e.code === 'messaging/registration-token-not-registered' ||
        e.code === 'messaging/invalid-registration-token') return 'remove';
    return false;
  }
}

const CRYPTO_MAP = {
  BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT', BNB:'BNBUSDT',
  XRP:'XRPUSDT', DOGE:'DOGEUSDT', ADA:'ADAUSDT', AVAX:'AVAXUSDT',
  DOT:'DOTUSDT', LINK:'LINKUSDT', MATIC:'MATICUSDT', ATOM:'ATOMUSDT',
  SUI:'SUIUSDT', NEAR:'NEARUSDT', PEPE:'PEPEUSDT', SHIB:'SHIBUSDT',
};

// ── Upstash Redis helper ──────────────────────────────────────
async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  return d.result;
}

// ── Price fetchers ────────────────────────────────────────────
// NOTE: api.binance.com is geo-blocked (HTTP 451) from US datacenter IPs
// where Vercel functions run. Use sources that work from US servers.
async function getCryptoPrice(symbol) {
  const pair = CRYPTO_MAP[symbol.toUpperCase()];
  if (!pair) return null;

  // 1. Binance public market-data endpoint — same format, NOT geo-blocked
  try {
    const r = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${pair}`);
    if (r.ok) { const d = await r.json(); const p = parseFloat(d.price); if (p) return p; }
  } catch {}

  // 2. Coinbase fallback (BTC-USD format)
  try {
    const base = pair.replace(/USDT$/, '').replace(/BTC$/, '');
    const r = await fetch(`https://api.coinbase.com/v2/prices/${base}-USD/spot`);
    if (r.ok) { const d = await r.json(); const p = parseFloat(d?.data?.amount); if (p) return p; }
  } catch {}

  return null;
}

async function getStockPrice(symbol) {
  const sym = symbol === 'GOLD' ? 'GC=F' : symbol === 'OIL' ? 'CL=F' : symbol;
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Referer: 'https://finance.yahoo.com' },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.quoteResponse?.result?.[0]?.regularMarketPrice ?? null;
}

async function getPrice(symbol) {
  const sym = symbol.toUpperCase();
  if (CRYPTO_MAP[sym]) return getCryptoPrice(sym);
  return getStockPrice(sym);
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify cron secret (Vercel sets x-vercel-cron header; also allow manual calls with ?secret=)
  const cronHeader = req.headers['x-vercel-cron'];
  const secret     = req.query?.secret;
  if (!cronHeader && CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  console.log(`[cron-push] ⏰ triggered at ${new Date().toISOString()}`);
  if (!REDIS_URL || !REDIS_TOKEN) { console.error('[cron-push] ❌ Redis not configured'); return res.status(503).json({ error: 'redis_not_configured' }); }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[cron-push] ❌ VAPID keys not configured');
    return res.status(503).json({ error: 'vapid_not_configured' });
  }

  webpush.setVapidDetails(
    'mailto:offir-b@zahav.net.il',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Get all stored subscriptions
  const raw = await redis(['HGETALL', 'beepai:subscriptions']);
  console.log(`[cron-push] 📦 Redis returned ${raw ? raw.length / 2 : 0} devices`);
  if (!raw || raw.length === 0) return res.json({ ok: true, sent: 0, devices: 0 });

  // raw = [deviceId1, json1, deviceId2, json2, ...]
  const devices = [];
  for (let i = 0; i < raw.length; i += 2) {
    try {
      const data = JSON.parse(raw[i + 1]);
      if ((data?.subscription || data?.fcmToken) && data?.alerts?.length) {
        devices.push({ deviceId: raw[i], ...data });
      }
    } catch {}
  }

  // Init Firebase Admin for FCM (Android APK)
  const firebaseAdmin = await getFCMApp();

  const debug   = req.query?.debug === '1';
  const dbg     = { firebaseReady: !!firebaseAdmin, devices: [] };
  const now     = Date.now();
  let sent      = 0;
  let errors    = 0;
  const toUpdate = [];

  // Collect all unique symbols across all devices
  const allSymbols = new Set();
  for (const d of devices) {
    for (const a of d.alerts) {
      if (!a.triggered && (!a.expiresAt || now < a.expiresAt)) allSymbols.add(a.symbol.toUpperCase());
    }
  }

  // Fetch all prices in parallel
  const prices = {};
  await Promise.allSettled(
    [...allSymbols].map(sym => getPrice(sym).then(p => { if (p) prices[sym] = p; }).catch(() => {}))
  );

  // Process each device
  for (const device of devices) {
    const { deviceId, subscription, fcmToken, alerts } = device;
    let changed = false;
    let deviceDead = false;
    const ddbg = { deviceId, hasFcm: !!fcmToken, hasSub: !!subscription, hits: [] };

    for (const alert of alerts) {
      if (alert.triggered) continue;
      if (alert.expiresAt && now >= alert.expiresAt) {
        alert.triggered = true; alert.triggeredAt = now; alert.expiredOut = true;
        changed = true; continue;
      }

      const price = prices[alert.symbol?.toUpperCase()];
      if (!price) continue;

      const hit = alert.direction === 'above' ? price >= alert.target : price <= alert.target;
      if (debug && hit) ddbg.hits.push({ symbol: alert.symbol, direction: alert.direction, target: alert.target, price });
      if (!hit) continue;

      const title = `⚡ BEEP AI — ${alert.symbol}`;
      const body  = `${alert.symbol} ${alert.direction === 'above' ? '↑ מעל' : '↓ מתחת'} $${Number(alert.target).toLocaleString()} | כעת: $${price.toFixed(2)}`;
      const tag   = `beepai-${alert.id || Date.now()}`;
      let delivered = false;

      // ── Web Push (browser) ──
      if (subscription) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify({ title, body, tag, data: { url: '/' } }));
          console.log(`[cron-push] ✅ WebPush sent to ${deviceId} for ${alert.symbol}`);
          sent++; delivered = true;
        } catch (err) {
          errors++;
          console.error(`[cron-push] ❌ WebPush failed device=${deviceId} status=${err.statusCode}`);
          if ([410, 404, 401, 403].includes(err.statusCode)) { deviceDead = true; break; }
        }
      }

      // ── FCM (Android APK) ──
      if (fcmToken && firebaseAdmin) {
        const result = await sendFCM(firebaseAdmin, fcmToken, title, body, tag);
        if (result === true) { console.log(`[cron-push] ✅ FCM sent to ${deviceId}`); sent++; delivered = true; }
        else if (result === 'remove') { deviceDead = true; break; }
        else errors++;
      }

      // Only consume the alert if a notification was actually delivered —
      // otherwise leave it pending so the next cron run retries
      if (delivered) {
        alert.triggered = true; alert.triggeredAt = now; alert.triggeredPrice = price;
        changed = true;
      }
    }

    if (debug) dbg.devices.push(ddbg);

    if (deviceDead) {
      console.log(`[cron-push] 🗑 removing dead device ${deviceId}`);
      toUpdate.push(['HDEL', 'beepai:subscriptions', deviceId]);
    } else if (changed) {
      toUpdate.push(['HSET', 'beepai:subscriptions', deviceId,
        JSON.stringify({ subscription, fcmToken, alerts, updatedAt: now })]);
    }
  }

  // Batch-write updates to Redis
  if (toUpdate.length > 0) {
    await Promise.allSettled(toUpdate.map(cmd => redis(cmd)));
  }

  console.log(`[cron-push] ✅ done — sent=${sent} errors=${errors} devices=${devices.length}`);
  res.json({ ok: true, sent, errors, devices: devices.length, symbols: [...allSymbols], ...(debug ? { debug: dbg, prices } : {}) });
}
