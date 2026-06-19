/**
 * Minimal Upstash Redis REST client — no SDK, just fetch().
 * אותו מנגנון אחסון ענן שכבר משמש את שאר הרובוטים (cron-push וכו').
 * Env vars (מוגדרים ב-Vercel):
 *   UPSTASH_REDIS_REST_URL   = https://xxxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN = AXxxxxxxxx
 */

const cleanEnv = (k) => (process.env[k] || '').replace(/^﻿/, '').trim();
const URL = () => cleanEnv('UPSTASH_REDIS_REST_URL');
const TOKEN = () => cleanEnv('UPSTASH_REDIS_REST_TOKEN');

async function cmd(...args) {
  const url = URL();
  const token = TOKEN();
  if (!url || !token) throw new Error('Upstash env vars not set');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export const redis = {
  get: (key) => cmd('GET', key).then((r) => (r ? JSON.parse(r) : null)),
  set: (key, val, ex) => cmd('SET', key, JSON.stringify(val), ...(ex ? ['EX', ex] : [])),
  del: (key) => cmd('DEL', key),
  sadd: (key, ...m) => cmd('SADD', key, ...m),
  smembers: (key) => cmd('SMEMBERS', key).then((r) => r || []),
  hset: (key, field, val) => cmd('HSET', key, String(field), JSON.stringify(val)),
  hdel: (key, field) => cmd('HDEL', key, String(field)),
  hgetall: (key) =>
    cmd('HGETALL', key).then((r) => {
      if (!r || !Array.isArray(r)) return {};
      const obj = {};
      for (let i = 0; i < r.length; i += 2) {
        try { obj[r[i]] = JSON.parse(r[i + 1]); } catch { obj[r[i]] = r[i + 1]; }
      }
      return obj;
    }),
  isReady: () => !!(URL() && TOKEN()),
};
