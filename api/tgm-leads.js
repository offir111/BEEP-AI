/**
 * /api/tgm-leads — מחזיר את כל הלידים השמורים בענן (Redis).
 * configured=false → אין Redis (פיתוח מקומי), הלקוח יחזור למצב מקומי.
 */
import { redis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!redis.isReady()) {
    return res.status(200).json({ configured: false, leads: [] });
  }
  try {
    const map = await redis.hgetall('tgm:leads');
    const leads = Object.values(map);
    const lastCron = await redis.get('tgm:lastCron');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({ configured: true, leads, lastCron });
  } catch (e) {
    res.status(502).json({ configured: true, leads: [], error: e.message });
  }
}
