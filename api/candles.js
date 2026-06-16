// /api/candles.js — Vercel Serverless Function
// Yahoo Finance OHLCV candles for any symbol (stocks, GOLD, indices).
// Supports timeframe via ?interval= (mapped to Yahoo interval + range).

// frontend/Binance interval → Yahoo { interval, range }
const YMAP = {
  '5m':  { yi: '5m',  range: '5d'  },
  '15m': { yi: '15m', range: '1mo' },
  '1h':  { yi: '60m', range: '3mo' },
  '4h':  { yi: '60m', range: '6mo' }, // Yahoo has no 4h → hourly, wider range
  '1d':  { yi: '1d',  range: '1y'  },
  '1w':  { yi: '1wk', range: '5y'  },
  '1M':  { yi: '1mo', range: 'max' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required', candles: [] });

  const map = YMAP[req.query?.interval] || YMAP['1d'];

  const yahooHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com',
  };

  const tryFetch = async (host, range) => {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${map.yi}&range=${range}`;
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
        time:  t,
        open:  quote.open?.[i]  ?? null,
        high:  quote.high?.[i]  ?? null,
        low:   quote.low?.[i]   ?? null,
        close: quote.close?.[i] ?? null,
        volume: quote.volume?.[i] ?? 0,
      }))
      .filter(c => c.open != null && c.high != null && c.low != null && c.close != null);

    return candles.length ? candles : null;
  };

  try {
    let candles = await tryFetch('query1.finance.yahoo.com', map.range).catch(() => null);
    if (!candles) candles = await tryFetch('query2.finance.yahoo.com', map.range).catch(() => null);
    if (!candles) candles = await tryFetch('query1.finance.yahoo.com', '1y').catch(() => null);
    return res.status(200).json({ candles: candles || [], symbol });
  } catch (err) {
    return res.status(200).json({ candles: [], symbol, error: err.message });
  }
}
