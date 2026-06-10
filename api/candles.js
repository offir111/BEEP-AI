// /api/candles.js — Vercel Serverless Function
// Returns daily OHLCV candles for any Yahoo Finance symbol.
// Used by AlertChart for stocks, GOLD (GC=F), indices, etc.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required', candles: [] });

  const yahooHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com',
  };

  const tryFetch = async (host, range = '1y') => {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const r = await fetch(url, { headers: yahooHeaders });
    if (!r.ok) return null;
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp;
    const quote      = result.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;

    const candles = timestamps
      .map((t, i) => ({
        time:  t,                          // Unix seconds — matches lightweight-charts format
        open:  quote.open?.[i]  ?? null,
        high:  quote.high?.[i]  ?? null,
        low:   quote.low?.[i]   ?? null,
        close: quote.close?.[i] ?? null,
      }))
      .filter(c => c.open != null && c.high != null && c.low != null && c.close != null);

    return candles.length ? candles : null;
  };

  try {
    // Try primary host first, then fallback
    let candles = await tryFetch('query1.finance.yahoo.com', '1y').catch(() => null);
    if (!candles) candles = await tryFetch('query2.finance.yahoo.com', '1y').catch(() => null);
    if (!candles) candles = await tryFetch('query1.finance.yahoo.com', '2y').catch(() => null);

    return res.status(200).json({ candles: candles || [], symbol });
  } catch (err) {
    return res.status(200).json({ candles: [], symbol, error: err.message });
  }
}
