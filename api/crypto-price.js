// /api/crypto-price?symbols=BTC,ETH,SOL,BNB — server-side crypto price fallback.
//
// The home crypto tiles use a *browser* Binance WebSocket for real-time prices. When the
// user's region/network blocks Binance (Israel and others get HTTP 451 / blocked sockets),
// the tiles go empty. This proxy fetches the same data server-side from the reachable
// data-api.binance.vision mirror so the tiles always have a price + daily %.
//
// Returns: { ok, ts, prices: { BTC: { price, open, changePct }, ... } }

const MIRROR = 'https://data-api.binance.vision/api/v3/ticker/24hr';

async function fetchOne(sym) {
  try {
    const r = await fetch(`${MIRROR}?symbol=${sym}USDT`, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const d = await r.json();
    const price = parseFloat(d.lastPrice);
    const open  = parseFloat(d.openPrice);
    const chg   = parseFloat(d.priceChangePercent);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      price,
      open:      Number.isFinite(open) ? open : null,
      changePct: Number.isFinite(chg)  ? chg  : null,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const syms = (req.query?.symbols || 'BTC,ETH,SOL,BNB')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);

  const results = await Promise.all(syms.map(fetchOne));
  const prices = {};
  syms.forEach((sym, i) => { if (results[i]) prices[sym] = results[i]; });

  return res.status(200).json({ ok: Object.keys(prices).length > 0, ts: Date.now(), prices });
}
