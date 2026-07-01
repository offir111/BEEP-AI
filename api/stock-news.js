/**
 * /api/stock-news?symbol=AAPL&limit=8
 *
 * חדשות אמיתיות למניה מ-Yahoo Finance (אותו ספק שכבר מזין את הגרף/מחירים).
 * מקור: query{1,2}.finance.yahoo.com/v1/finance/search — מחזיר news[] אמיתי
 * (כותרת, מפרסם, קישור, זמן). ללא crumb. עוטף ב-try/catch — לעולם לא זורק.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim().toUpperCase();
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 8, 1), 20);
  if (!symbol) return res.status(400).json({ error: 'symbol required', news: [] });

  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${limit}&quotesCount=0&enableFuzzyQuery=false`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(9000) }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const raw = Array.isArray(d?.news) ? d.news : [];
      const news = raw
        .filter(n => n && n.title && (n.link || n.clickThroughUrl?.url))
        .slice(0, limit)
        .map(n => ({
          title: n.title,
          url: n.link || n.clickThroughUrl?.url || null,
          publisher: n.publisher || null,
          ts: Number.isFinite(n.providerPublishTime) ? n.providerPublishTime * 1000 : null,
        }));
      if (news.length) return res.status(200).json({ symbol, source: 'yahoo', live: true, news });
    } catch { /* next host */ }
  }
  return res.status(200).json({ symbol, source: 'yahoo', live: false, news: [] });
}
