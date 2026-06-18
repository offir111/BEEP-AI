// /api/vapid-public.js — Returns VAPID public key for Web Push subscription
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'push_not_configured' });
  res.json({ publicKey: key });
}
