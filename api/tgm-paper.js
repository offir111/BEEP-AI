// api/tgm-paper.js — GET: מחזיר את ה-track record החי של ה-Paper Trading.
// קורא מ-Redis (אותו אחסון שה-cron כותב אליו) ומחשב סיכום פורטפוליו וירטואלי.
// אם Redis לא מוגדר → configured:false (הלקוח יציג הסבר איך להפעיל).

import { redis } from './_redis.js';
import { clockStatus } from './_marketClock.js';

const OPEN_KEY = 'tgm:paper:open';
const CLOSED_KEY = 'tgm:paper:closed';
const META_KEY = 'tgm:paper:meta';
const PORTFOLIO_USD = 100000;

const r2 = (n) => Math.round(n * 100) / 100;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!redis.isReady()) {
    return res.status(200).json({ configured: false, reason: 'Upstash Redis לא מוגדר ב-Vercel', clock: clockStatus() });
  }

  try {
    const [openMap, closedMap, meta] = await Promise.all([
      redis.hgetall(OPEN_KEY), redis.hgetall(CLOSED_KEY), redis.get(META_KEY),
    ]);
    const open = Object.values(openMap).sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
    const closed = Object.values(closedMap).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));

    const wins = closed.filter((c) => c.status === 'win');
    const losses = closed.filter((c) => c.status === 'loss');
    const resolved = wins.length + losses.length;
    const realizedUsd = r2(closed.reduce((s, c) => s + (Number(c.pnlUsd) || 0), 0));
    const unrealizedUsd = r2(open.reduce((s, p) => s + (p.shares * p.entry * ((Number(p.lastPnlPct) || 0) / 100)), 0));
    const grossWin = wins.reduce((s, c) => s + (Number(c.pnlPct) || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, c) => s + (Number(c.pnlPct) || 0), 0));

    const summary = {
      startedAt: meta?.startedAt || null,
      startedEtDate: meta?.startedEtDate || null,
      lastCronAt: meta?.lastCronAt || null,
      openCount: open.length,
      closedCount: closed.length,
      wins: wins.length,
      losses: losses.length,
      resolved,
      winRate: resolved >= 10 ? r2((wins.length / resolved) * 100) : null,
      sampleTooSmall: resolved < 10,
      realizedUsd,
      unrealizedUsd,
      profitFactor: resolved > 0 ? (grossLoss === 0 ? null : r2(grossWin / grossLoss)) : null,
      portfolioStart: PORTFOLIO_USD,
      portfolioValue: r2(PORTFOLIO_USD + realizedUsd + unrealizedUsd),
    };

    res.status(200).json({ configured: true, clock: clockStatus(), summary, open, closed: closed.slice(0, 200) });
  } catch (e) {
    res.status(200).json({ configured: true, error: e.message, clock: clockStatus() });
  }
}
