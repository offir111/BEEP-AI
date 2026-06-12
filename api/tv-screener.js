/**
 * /api/tv-screener — Vercel Serverless Function
 * TradingView Scanner API — נתוני זמן אמת לכל הבורסה האמריקאית
 * תומך: cap filter + period (1h/1d/1w/1m/1y)
 */

let _cache   = {};
let _cacheTs = {};
const CACHE_MS = 5 * 60 * 1000; // 5 דקות cache

const TV_URL = 'https://scanner.tradingview.com/america/scan';

// כל השדות שנרצה לקבל
const COLS = [
  'name',                    // 0 — ticker  e.g. "NASDAQ:AAPL"
  'description',             // 1 — שם חברה
  'close',                   // 2 — מחיר נוכחי
  'change',                  // 3 — שינוי % יומי (1D)
  'market_cap_calc',         // 4 — שווי שוק
  'volume',                  // 5 — נפח יומי
  'RSI',                     // 6 — RSI(14)
  'Perf.W',                  // 7 — ביצוע שבועי %
  'Perf.1M',                 // 8 — ביצוע חודשי %
  'Perf.Y',                  // 9 — ביצוע שנתי %
];

// פרמטר period → שדה מיון ב-TradingView
const SORT_COL = {
  '1h': 'change',
  '1d': 'change',
  '1w': 'Perf.W',
  '1m': 'Perf.1M',
  '1y': 'Perf.Y',
};

// פילטרים בסיסיים
const BASE = [
  { left: 'type',    operation: 'equal',    right: 'stock' },
  { left: 'subtype', operation: 'in_range', right: ['common', 'foreign-issuer'] },
  { left: 'average_volume_10d_calc', operation: 'greater', right: 300_000 },
];

// מיפוי cap parameter → פילטר TradingView
const CAP_MAP = {
  'all':  { operation: 'greater',  right: 10_000_000 },
  '10m':  { operation: 'in_range', right: [10_000_000,    100_000_000]    },
  '100m': { operation: 'in_range', right: [100_000_000,   1_000_000_000]  },
  '1b':   { operation: 'in_range', right: [1_000_000_000, 5_000_000_000]  },
  '5b':   { operation: 'in_range', right: [5_000_000_000, 10_000_000_000] },
  '10b':  { operation: 'greater',  right: 10_000_000_000 },
};

/* ── שליחת בקשה ל-TradingView Scanner ─────────────────────── */
async function tvScan(filters, sortBy, sortOrder, count) {
  const res = await fetch(TV_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter:  filters,
      options: { lang: 'en' },
      symbols: { query: { types: ['stock'] }, tickers: [] },
      columns: COLS,
      sort:    { sortBy, sortOrder },
      range:   [0, count],
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) throw new Error(`TradingView HTTP ${res.status}`);
  const json = await res.json();

  return (json.data || []).map(({ s, d }) => ({
    symbol:     (s.split(':')[1] || s).toUpperCase(),
    name:       (d[1] || '').slice(0, 32),
    price:      d[2] != null ? +Number(d[2]).toFixed(2) : 0,
    change_pct: d[3] != null ? +Number(d[3]).toFixed(2) : 0,  // תמיד 1D
    market_cap: d[4] || 0,
    volume:     d[5] || 0,
    rsi:        d[6] != null ? +Number(d[6]).toFixed(1)  : null,
    pct_1w:     d[7] != null ? +Number(d[7]).toFixed(2)  : null,
    pct_1m:     d[8] != null ? +Number(d[8]).toFixed(2)  : null,
    pct_1y:     d[9] != null ? +Number(d[9]).toFixed(2)  : null,
  }));
}

/* ── handler ─────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cap    = (req.query.cap    || 'all').toLowerCase();
  const period = (req.query.period || '1d').toLowerCase();
  const cacheKey = `${cap}:${period}`;
  const now = Date.now();

  // החזר cache אם טרי
  if (_cache[cacheKey] && now - (_cacheTs[cacheKey] || 0) < CACHE_MS) {
    return res.status(200).json({ ..._cache[cacheKey], fromCache: true });
  }

  try {
    const capF   = CAP_MAP[cap] || CAP_MAP['all'];
    const sortBy = SORT_COL[period] || 'change';

    const filters = [
      ...BASE,
      { left: 'market_cap_calc', ...capF },
    ];

    // gainers (desc) + losers (asc) במקביל
    const [gainers, losers] = await Promise.all([
      tvScan(filters, sortBy, 'desc', 25),
      tvScan(filters, sortBy, 'asc',   6),
    ]);

    // ייחוד — אין כפילויות
    const seen         = new Set(gainers.map(s => s.symbol));
    const uniqueLosers = losers.filter(s => !seen.has(s.symbol));

    // החלף change_pct בערך של ה-period שנבחר
    const setPct = (stock) => {
      let pct = stock.change_pct; // default: 1D
      if ((period === '1w') && stock.pct_1w != null) pct = stock.pct_1w;
      if ((period === '1m') && stock.pct_1m != null) pct = stock.pct_1m;
      if ((period === '1y') && stock.pct_1y != null) pct = stock.pct_1y;
      return { ...stock, change_pct: pct };
    };

    const quotes  = [...gainers, ...uniqueLosers].map(setPct);
    const payload = { quotes, count: quotes.length, cap, period };

    _cache[cacheKey]   = payload;
    _cacheTs[cacheKey] = now;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[tv-screener]', err.message);
    // fallback: cache ישן אם קיים
    if (_cache[cacheKey]) {
      return res.status(200).json({ ..._cache[cacheKey], fromCache: true, stale: true });
    }
    return res.status(500).json({ error: err.message, quotes: [], count: 0 });
  }
}
