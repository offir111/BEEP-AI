/**
 * /api/tgm-telegram?channel=cryptosignals
 * מחזיר סיגנלים מפוענחים מערוץ טלגרם ציבורי חינמי (קצירה צד-שרת, עוקף CORS).
 * channel=all → כל הערוצים הרשומים.
 */
import { fetchChannelSignals, TELEGRAM_CHANNELS } from './_tgmTelegram.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const channel = String(req.query.channel || 'all');
  const channels = channel === 'all' ? Object.keys(TELEGRAM_CHANNELS) : [channel];

  try {
    const results = await Promise.allSettled(channels.map((c) => fetchChannelSignals(c)));
    const signals = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') signals.push(...r.value);
      else errors.push({ channel: channels[i], error: r.reason?.message || String(r.reason) });
    });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ signals, errors, channels });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
