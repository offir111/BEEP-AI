/**
 * /api/gainers — Yahoo Finance Top Gainers + Top 3 Losers
 * Returns gainers (filtered by MC) + top 3 losers (same MC filter)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const cap = req.query.cap || 'all';

  const CAP_RANGES = {
    'all':  { min: 10_000_000,      max: Infinity         },
    '10m':  { min: 10_000_000,      max: 100_000_000      },
    '100m': { min: 100_000_000,     max: 1_000_000_000    },
    '1b':   { min: 1_000_000_000,   max: 5_000_000_000    },
    '5b':   { min: 5_000_000_000,   max: 10_000_000_000   },
    '10b':  { min: 10_000_000_000,  max: Infinity         },
  };
  const range = CAP_RANGES[cap] || CAP_RANGES['all'];

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  try {
    /* ── Step 1: crumb + cookie ── */
    const initResp = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const rawCookies = (initResp.headers.get('set-cookie') || '')
      .split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

    const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': rawCookies },
    });
    const crumb = await crumbResp.text();

    const HEADERS = {
      'User-Agent': UA, 'Accept': 'application/json',
      'Cookie': rawCookies,
      'Referer': 'https://finance.yahoo.com/screener/predefined/day_gainers',
    };

    /* ── Step 2: gainers + losers in parallel ── */
    const makeUrl = (scrId) =>
      `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved` +
      `?scrIds=${scrId}&count=100&start=0&crumb=${encodeURIComponent(crumb)}`;

    const [gainersResp, losersResp] = await Promise.all([
      fetch(makeUrl('day_gainers'), { headers: HEADERS }),
      fetch(makeUrl('day_losers'),  { headers: HEADERS }),
    ]);

    const gainersData = gainersResp.ok ? await gainersResp.json() : { finance: { result: [] } };
    const losersData  = losersResp.ok  ? await losersResp.json()  : { finance: { result: [] } };

    const gainersRaw = gainersData?.finance?.result?.[0]?.quotes || [];
    const losersRaw  = losersData?.finance?.result?.[0]?.quotes  || [];

    /* ── Step 3: map helper ── */
    const mapQ = q => ({
      symbol:     q.symbol,
      name:       q.shortName || q.longName || q.symbol,
      price:      q.regularMarketPrice          ?? 0,
      change_pct: q.regularMarketChangePercent   ?? 0,
      volume:     q.regularMarketVolume          ?? 0,
      market_cap: q.marketCap                    ?? 0,
    });

    const inRange = q =>
      q.market_cap >= range.min &&
      (range.max === Infinity || q.market_cap < range.max);

    /* ── Gainers: all that pass filter, sorted desc ── */
    const gainers = gainersRaw.map(mapQ)
      .filter(q => q.change_pct > 0 && inRange(q))
      .sort((a, b) => b.change_pct - a.change_pct);

    /* ── Losers: top 3 worst ── */
    const losers = losersRaw.map(mapQ)
      .filter(q => q.change_pct < 0 && inRange(q))
      .sort((a, b) => a.change_pct - b.change_pct)   // most negative first
      .slice(0, 3);

    const result = [...gainers, ...losers];

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json({ quotes: result, count: result.length, cap });

  } catch (err) {
    console.error('[gainers]', err.message);
    res.status(500).json({ error: err.message, quotes: [], count: 0 });
  }
}
