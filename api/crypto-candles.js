/**
 * /api/crypto-candles?symbol=BTCUSDT&interval=1d — Binance klines via public
 * mirror (data-api.binance.vision), server-side so it works behind a Binance block.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol   = (req.query.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const interval = (req.query.interval || '1d');
  const cg       = (req.query.cg || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

  let candles = [];

  // 1) Binance public mirror (proper daily candles for listed pairs)
  try {
    const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`);
    if (r.ok) {
      const raw = await r.json();
      if (Array.isArray(raw)) candles = raw.map(k => ({
        time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4],
      }));
    }
  } catch {}

  // 2) Fallback — CoinGecko OHLC (works for any listed coin not on Binance)
  if (!candles.length && cg) {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${cg}/ohlc?vs_currency=usd&days=30`);
      const arr = await r.json();
      if (Array.isArray(arr)) candles = arr.map(k => ({
        time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4],
      }));
    } catch {}
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.json({ candles });
}
