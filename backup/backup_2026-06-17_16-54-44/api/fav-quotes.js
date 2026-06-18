/**
 * /api/fav-quotes — Yahoo Finance quotes for specific symbols (favorites)
 * GET /api/fav-quotes?symbols=NVDA,TSLA,AAPL
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return res.status(200).json({ quotes: [] });

  try {
    for (const host of ['query1', 'query2']) {
      try {
        const url = `https://${host}.finance.yahoo.com/v7/finance/quote` +
          `?symbols=${encodeURIComponent(symbols.join(','))}` +
          `&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,marketCap,regularMarketVolume`;

        const r = await fetch(url, {
          headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        });
        if (!r.ok) continue;
        const data = await r.json();
        const results = data?.quoteResponse?.result || [];

        const quotes = results.map(q => ({
          symbol:     q.symbol,
          name:       q.shortName || q.symbol,
          price:      q.regularMarketPrice       ?? 0,
          change_pct: q.regularMarketChangePercent ?? 0,
          market_cap: q.marketCap                ?? 0,
          volume:     q.regularMarketVolume      ?? 0,
          _type:      'stocks',
        }));

        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        return res.status(200).json({ quotes, count: quotes.length });
      } catch { /* try next host */ }
    }
    return res.status(200).json({ quotes: [], count: 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message, quotes: [] });
  }
}
