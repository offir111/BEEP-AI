// /api/market.js — Vercel Serverless Function
// Returns live price for any Yahoo Finance symbol (AAPL, GC=F, ^GSPC, etc.)
// Called by AlertsContext.fetchLivePrice(), ChartsPage, EtoroPage, etc.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required', price: null });

  // Try Yahoo Finance v7 quote API
  const tryYahooV7 = async () => {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=regularMarketPrice,postMarketPrice,preMarketPrice,regularMarketChangePercent,shortName`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com',
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return null;
    return {
      price: quote.regularMarketPrice ?? null,
      postPrice: quote.postMarketPrice ?? null,
      prePrice: quote.preMarketPrice ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
      name: quote.shortName ?? symbol,
    };
  };

  // Fallback: Yahoo Finance v8 chart API (more permissive)
  const tryYahooChart = async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? meta.previousClose ?? null,
      changePercent: null,
      name: meta.shortName ?? symbol,
    };
  };

  // Second Yahoo host fallback
  const tryYahooV7Alt = async () => {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return null;
    return {
      price: quote.regularMarketPrice ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
      name: quote.shortName ?? symbol,
    };
  };

  try {
    // Try all sources in order
    let result = await tryYahooV7().catch(() => null);
    if (!result?.price) result = await tryYahooV7Alt().catch(() => null);
    if (!result?.price) result = await tryYahooChart().catch(() => null);

    if (result?.price) {
      return res.status(200).json({
        price: parseFloat(result.price),
        changePercent: result.changePercent ?? null,
        name: result.name,
        symbol,
      });
    }

    // No data available (market closed, invalid symbol)
    return res.status(200).json({ price: null, symbol, error: 'no_data' });

  } catch (err) {
    return res.status(200).json({ price: null, symbol, error: err.message });
  }
}
