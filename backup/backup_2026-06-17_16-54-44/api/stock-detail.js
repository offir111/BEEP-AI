/**
 * /api/stock-detail?symbol=AAPL&period=1h|1d|1w|1m
 * Returns price history + multi-period % changes
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { symbol, period = '1d' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  // Chart params per period
  const CHART_PARAMS = {
    '1h': { interval: '5m',  range: '1d'  },
    '1d': { interval: '30m', range: '5d'  },
    '1w': { interval: '1d',  range: '1mo' },
    '1m': { interval: '1d',  range: '3mo' },
  };
  const { interval, range } = CHART_PARAMS[period] || CHART_PARAMS['1d'];

  try {
    // ── Fetch chart + quote in parallel ──────────────────────
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
      `?interval=${interval}&range=${range}&includePrePost=false`;

    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote` +
      `?symbols=${symbol}&fields=regularMarketPrice,regularMarketChangePercent,` +
      `regularMarketVolume,marketCap,fiftyTwoWeekHigh,fiftyTwoWeekLow,shortName`;

    const [chartResp, quoteResp] = await Promise.all([
      fetch(chartUrl, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }),
      fetch(quoteUrl, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }),
    ]);

    const chartData = chartResp.ok ? await chartResp.json() : {};
    const quoteData = quoteResp.ok ? await quoteResp.json() : {};

    // ── Parse chart ────────────────────────────────────────
    const result  = chartData?.chart?.result?.[0];
    const allClose = result?.indicators?.quote?.[0]?.close || [];
    const allTs    = result?.timestamp || [];

    // Filter nulls, pair timestamps with prices
    const pairs = allTs
      .map((t, i) => ({ t, p: allClose[i] }))
      .filter(x => x.p != null);

    // For 1H: last 12 points of 5-min data = 60 minutes
    const sliced = period === '1h' ? pairs.slice(-12) : pairs;
    const prices = sliced.map(x => x.p);
    const timestamps = sliced.map(x => x.t * 1000); // to ms

    // Period % change: (last - first) / first * 100
    const periodPct = prices.length >= 2
      ? ((prices.at(-1) - prices[0]) / prices[0]) * 100
      : null;

    // ── Parse quote ────────────────────────────────────────
    const q = quoteData?.quoteResponse?.result?.[0] || {};

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.json({
      symbol,
      name:        q.shortName || symbol,
      price:       q.regularMarketPrice,
      change_pct:  q.regularMarketChangePercent,
      market_cap:  q.marketCap,
      volume:      q.regularMarketVolume,
      week52_high: q.fiftyTwoWeekHigh,
      week52_low:  q.fiftyTwoWeekLow,
      period_pct:  periodPct,
      prices,
      timestamps,
    });

  } catch (err) {
    console.error('[stock-detail]', err.message);
    res.status(500).json({ error: err.message, prices: [] });
  }
}
