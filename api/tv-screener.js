/**
 * /api/tv-screener — Vercel Serverless Function
 * TradingView Scanner — real-time US stocks
 * Params: cap, period, signal (vol | break | mom)
 */

let _cache   = {};
let _cacheTs = {};
const CACHE_MS = 60 * 1000;

const TV_URL = 'https://scanner.tradingview.com/america/scan';

const COLS = [
  'name',                      // 0
  'description',               // 1
  'close',                     // 2 — price
  'change',                    // 3 — 1D %
  'market_cap_calc',           // 4
  'volume',                    // 5
  'RSI',                       // 6
  'Perf.W',                    // 7
  'Perf.1M',                   // 8
  'Perf.Y',                    // 9
  'relative_volume_10d_calc',  // 10
  'Recommend.All',             // 11
];

const PERIOD_SORT = {
  '1h': 'change', '1d': 'change',
  '1w': 'Perf.W', '1m': 'Perf.1M', '1y': 'Perf.Y',
};

const BASE = [
  { left: 'type',    operation: 'equal',    right: 'stock' },
  { left: 'subtype', operation: 'in_range', right: ['common', 'foreign-issuer'] },
  { left: 'average_volume_10d_calc', operation: 'greater', right: 300_000 },
  { left: 'close',   operation: 'greater',  right: 2 },   // quality — no sub-$2 penny pumps
];

const CAP_MAP = {
  'all':  { operation: 'greater',  right: 10_000_000 },
  '10m':  { operation: 'in_range', right: [10_000_000,    100_000_000]    },
  '100m': { operation: 'in_range', right: [100_000_000,   1_000_000_000]  },
  '1b':   { operation: 'in_range', right: [1_000_000_000, 5_000_000_000]  },
  '5b':   { operation: 'in_range', right: [5_000_000_000, 10_000_000_000] },
  '10b':  { operation: 'greater',  right: 10_000_000_000 },
};

// ── Signal presets ──────────────────────────────────────────────
const SIGNAL_CONFIG = {
  vol: {   // 🔥 Volume Spike — volume > 2.5× average + price going up
    extraFilters: [
      { left: 'relative_volume_10d_calc', operation: 'greater', right: 2.5 },
      { left: 'change', operation: 'greater', right: 1 },
    ],
    sortBy: 'relative_volume_10d_calc',  // sort by who has highest relative volume
  },
  break: { // 💥 Breakout Zone — RSI in momentum zone + strong technicals
    extraFilters: [
      { left: 'RSI',           operation: 'in_range', right: [55, 72] },
      { left: 'Recommend.All', operation: 'greater',  right: 0.4     },
      { left: 'change',        operation: 'greater',  right: 0       },
    ],
    sortBy: 'Recommend.All',
  },
  mom: {   // 🚀 Momentum Leaders — strong week + RSI + technicals
    extraFilters: [
      { left: 'Perf.W',        operation: 'greater', right: 5  },
      { left: 'RSI',           operation: 'greater', right: 60 },
      { left: 'Recommend.All', operation: 'greater', right: 0.3},
    ],
    sortBy: 'Perf.W',
  },
};

// ── TradingView scan ────────────────────────────────────────────
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
    change_pct: d[3] != null ? +Number(d[3]).toFixed(2) : 0,
    chg1d:      d[3] != null ? +Number(d[3]).toFixed(2) : null,
    market_cap: d[4] || 0,
    volume:     d[5] || 0,
    rsi:        d[6] != null ? +Number(d[6]).toFixed(1)  : null,
    pct_1w:     d[7] != null ? +Number(d[7]).toFixed(2)  : null,
    pct_1m:     d[8] != null ? +Number(d[8]).toFixed(2)  : null,
    pct_1y:     d[9] != null ? +Number(d[9]).toFixed(2)  : null,
    rel_volume: d[10] != null ? +Number(d[10]).toFixed(2) : null,
    recommend:  d[11] != null ? +Number(d[11]).toFixed(3) : null,
  }));
}

// ── handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cap    = (req.query.cap    || 'all').toLowerCase();
  const period = (req.query.period || '1d').toLowerCase();
  const signal = (req.query.signal || '').toLowerCase();
  const cacheKey = `${cap}:${period}:${signal}`;
  const now = Date.now();

  if (_cache[cacheKey] && now - (_cacheTs[cacheKey] || 0) < CACHE_MS) {
    return res.status(200).json({ ..._cache[cacheKey], fromCache: true });
  }

  try {
    const capF    = CAP_MAP[cap] || CAP_MAP['all'];
    const sigConf = SIGNAL_CONFIG[signal];

    const filters = [
      ...BASE,
      { left: 'market_cap_calc', ...capF },
      ...(sigConf ? sigConf.extraFilters : []),
    ];

    let quotes;

    if (sigConf) {
      // ── Signal mode: single query sorted by signal metric ──
      quotes = await tvScan(filters, sigConf.sortBy, 'desc', 30);
    } else {
      // ── Normal mode: gainers + losers ──
      const sortBy = PERIOD_SORT[period] || 'change';
      const [gainers, losers] = await Promise.all([
        tvScan(filters, sortBy, 'desc', 25),
        tvScan(filters, sortBy, 'asc',   6),
      ]);
      const seen = new Set(gainers.map(s => s.symbol));
      quotes = [...gainers, ...losers.filter(s => !seen.has(s.symbol))];
    }

    // Set change_pct for selected period (non-signal mode)
    if (!sigConf) {
      quotes = quotes.map(stock => {
        let pct = stock.change_pct;
        if (period === '1w' && stock.pct_1w != null) pct = stock.pct_1w;
        if (period === '1m' && stock.pct_1m != null) pct = stock.pct_1m;
        if (period === '1y' && stock.pct_1y != null) pct = stock.pct_1y;
        return { ...stock, change_pct: pct };
      });
    }

    const payload = { quotes, count: quotes.length, cap, period, signal };
    _cache[cacheKey]   = payload;
    _cacheTs[cacheKey] = now;

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[tv-screener]', err.message);
    if (_cache[cacheKey]) return res.status(200).json({ ..._cache[cacheKey], stale: true });
    return res.status(500).json({ error: err.message, quotes: [], count: 0 });
  }
}
