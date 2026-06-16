// Vercel Serverless Function — symbol search proxy
// Calls Yahoo Finance search server-side (bypasses CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const q = (req.query?.q || '').trim();
  if (!q) return res.json([]);

  try {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0` +
      `&listsCount=0&enableFuzzyQuery=true&enableCb=false` +
      `&enableNavLinks=false&enableEnhancedTrivialQuery=true`;

    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
      },
    });

    if (!r.ok) return res.json([]);
    const data = await r.json();

    // Map Yahoo exchange codes → TradingView-recognised exchanges
    const TV_EXCH = {
      NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NAS: 'NASDAQ',
      NYQ: 'NYSE', NYS: 'NYSE', PNK: 'OTC',
      PCX: 'AMEX', ASE: 'AMEX', BTS: 'AMEX',
    };

    const items = (data?.quotes || [])
      .filter(item => item.quoteType === 'EQUITY')
      .slice(0, 12)
      .map(item => {
        const exch = TV_EXCH[item.exchange] || item.exchange || 'NASDAQ';
        return {
          symbol:      item.symbol,
          full_name:   `${exch}:${item.symbol}`,
          description: item.longname || item.shortname || item.symbol,
          exchange:    exch,
          type:        'stock',
        };
      });

    res.json(items);
  } catch {
    res.json([]);
  }
}
