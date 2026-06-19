/**
 * /api/tgm-cron — רץ אוטומטית בענן (Vercel Cron), גם כשהמחשב סגור.
 * 1) מושך לידים מערוצי הטלגרם החינמיים.
 * 2) בודק כל ליד חדש מול Binance ושומר ב-Redis (ענן עמיד).
 * 3) בודק מחדש לידים "פתוחים" עד שמוכרעים (ניצחון/הפסד).
 * ניתן גם להפעלה ידנית (GET) כדי לרענן מיד.
 */
import { fetchChannelSignals, TELEGRAM_CHANNELS } from './_tgmTelegram.js';
import { checkLead } from './_tgmCheck.js';
import { redis } from './_redis.js';

const LEADS_KEY = 'tgm:leads';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!redis.isReady()) {
    return res.status(200).json({ ok: false, reason: 'Upstash Redis not configured' });
  }

  const report = { pulled: 0, added: 0, rechecked: 0, resolved: 0, errors: [] };
  try {
    // 1) לידים קיימים מהענן
    const existing = await redis.hgetall(LEADS_KEY); // { field: lead }
    const seenPost = new Set(Object.values(existing).map((l) => l.postId).filter(Boolean));

    // 2) משיכת כל הערוצים
    const channels = Object.keys(TELEGRAM_CHANNELS);
    const results = await Promise.allSettled(channels.map((c) => fetchChannelSignals(c)));
    const signals = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') signals.push(...r.value);
      else report.errors.push({ channel: channels[i], error: String(r.reason?.message || r.reason) });
    });
    report.pulled = signals.length;

    // 3) לידים חדשים — בדיקה ושמירה
    for (const s of signals) {
      if (s.postId && seenPost.has(s.postId)) continue;
      const id = s.postId || `${s.provider}_${s.asset}_${s.dateMs}`;
      const lead = {
        id, provider: s.provider, asset: s.asset, direction: s.direction,
        entry: s.entry, tp: s.tp, sl: s.sl, dateMs: s.dateMs,
        postId: s.postId, source: 'telegram', createdAt: Date.now(),
      };
      try {
        const r = await checkLead(lead);
        Object.assign(lead, { status: r.result, reason: r.reason, exitPrice: r.exitPrice, closedAtMs: r.closedAtMs, checkedAt: Date.now() });
      } catch (e) {
        lead.status = 'error';
        lead.error = String(e.message);
      }
      await redis.hset(LEADS_KEY, id, lead);
      if (s.postId) seenPost.add(s.postId);
      report.added++;
    }

    // 4) בדיקה חוזרת ללידים פתוחים — להכרעתם לאורך זמן
    for (const [field, lead] of Object.entries(existing)) {
      if (lead.status !== 'open') continue;
      report.rechecked++;
      try {
        const r = await checkLead(lead);
        if (r.result !== 'open') report.resolved++;
        Object.assign(lead, { status: r.result, reason: r.reason, exitPrice: r.exitPrice, closedAtMs: r.closedAtMs, checkedAt: Date.now() });
        await redis.hset(LEADS_KEY, field, lead);
      } catch { /* משאיר פתוח אם הבדיקה נכשלה */ }
    }

    await redis.set('tgm:lastCron', Date.now());
    res.status(200).json({ ok: true, ...report });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, ...report });
  }
}
