/**
 * /api/binance?ep=ticker/24hr | ?ep=ticker&symbols=[..]&windowSize=1h
 * Passthrough to Binance public mirror (works behind a client-side Binance block).
 */
const ALLOWED = ['ticker/24hr', 'ticker', 'ticker/price', 'klines', 'depth', 'exchangeInfo'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ep = String(req.query.ep || 'ticker/24hr');
  if (!ALLOWED.includes(ep)) return res.status(400).json({ error: 'bad endpoint' });

  const params = [];
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'ep') continue;
    params.push(`${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : v)}`);
  }
  const url = `https://data-api.binance.vision/api/v3/${ep}${params.length ? `?${params.join('&')}` : ''}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    res.status(r.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
