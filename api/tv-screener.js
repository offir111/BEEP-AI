/**
 * /api/tv-screener — Vercel Serverless Function
 * TradingView Scanner API — נתוני זמן אמת לכל הבורסה האמריקאית
 * מקור: scanner.tradingview.com/america/scan (ללא API key)
 * מחזיר gainers + losers בפורמט זהה ל-gainers.js
 */

let _cache   = {};
let _cacheTs = {};
const CACHE_MS = 5 * 60 * 1000; // 5 דקות cache

const TV_URL = 'https://scanner.tradingview.com/america/scan';

// שדות שנרצה לקבל
const COLS = [
  'name',                    // 0 — ticker  (NASDAQ:AAPL)
  'description',             // 1 — שם חברה
  'close',                   // 2 — מחיר נוכחי
  'change',                  // 3 — שינוי % יומי
  'market_cap_calc',         // 4 — שווי שוק
  'volume',                  // 5 — נפח יומי
  'RSI',                     // 6 — RSI(14)
];

// פילטרים בסיסיים — מניות רגילות + נפח מינימלי
const BASE = [
  { left: 'type',    operation: 'equal',    right: 'stock' },
  { left: 'subtype', operation: 'in_range', right: ['common', 'foreign-issuer'] },
  { left: 'average_volume_10d_calc', operation: 'greater', right: 300_000 },
];

// מיפוי ה-cap parameter לפילטר TradingView
const CAP_MAP = {
  'all':  { operation: 'greater',   right: 10_000_000 },
  '10m':  { operation: 'in_range',  right: [10_000_000,    100_000_000]   },
  '100m': { operation: 'in_range',  right: [100_000_000,   1_000_000_000] },
  '1b':   { operation: 'in_range',  right: [1_000_000_000, 5_000_000_000] },
  '5b':   { operation: 'in_range',  right: [5_000_000_000, 10_000_000_000]},
  '10b':  { operation: 'greater',   right: 10_000_000_000 },
};

/* ── שליחת סריקה ל-TradingView ─────────────────────────────── */
async function tvScan(filters, sortOrder, count) {
  const res = await fetch(TV_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter:  filters,
      options: { lang: 'en' },
      symbols: { query: { types: ['stock'] }, tickers: [] },
      columns: COLS,
      sort:    { sortBy: 'change', sortOrder },
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
    change_pct: d[3] != null ? +Number(d[3]).toFixed(2) : 0,
    market_cap: d[4] || 0,
    volume:     d[5] || 0,
    rsi:        d[6] != null ? +Number(d[6]).toFixed(1) : null,
  }));
}

/* ── handler ─────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cap = (req.query.cap || 'all').toLowerCase();
  const now = Date.now();

  // החזר cache אם טרי
  if (_cache[cap] && now - (_cacheTs[cap] || 0) < CACHE_MS) {
    return res.status(200).json({ ..._cache[cap], fromCache: true });
  }

  try {
    // בנה פילטרים
    const capF = CAP_MAP[cap] || CAP_MAP['all'];
    const filters = [
      ...BASE,
      { left: 'market_cap_calc', ...capF },
    ];

    // הרץ gainers (desc) + losers (asc) במקביל
    const [gainers, losers] = await Promise.all([
      tvScan(filters, 'desc', 25),   // 25 מניות עולות
      tvScan(filters, 'asc',   6),   // 6  מניות יורדות
    ]);

    // ייחוד — הסר כפילויות בין gainers ו-losers
    const seen        = new Set(gainers.map(s => s.symbol));
    const uniqueLosers = losers.filter(s => !seen.has(s.symbol));

    const quotes = [...gainers, ...uniqueLosers];

    const payload = { quotes, count: quotes.length, cap };
    _cache[cap]   = payload;
    _cacheTs[cap] = now;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[tv-screener]', err.message);

    // fallback: החזר cache ישן אם קיים
    if (_cache[cap]) {
      return res.status(200).json({ ..._cache[cap], fromCache: true, stale: true });
    }
    return res.status(500).json({ error: err.message, quotes: [], count: 0 });
  }
}
