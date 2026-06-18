/**
 * /api/crypto-gainers — CoinGecko (universe + cap + all TFs) overlaid with
 * live Binance price (data-api.binance.vision — public mirror, not geo-blocked).
 * Coins with market cap > $10M. Never empty (CoinGecko is the reliable base).
 */
let _cache = null, _ts = 0;
let _cg = {}, _cgTs = 0;
let _p5m = {}, _p5mTs = 0;   // 5-minute change cache (heavy endpoint → throttled)

const MIN_CAP = 10_000_000;
const CG_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y';
const BIN_URL = 'https://data-api.binance.vision/api/v3/ticker/24hr';

async function getCG() {
  const now = Date.now();
  if (Object.keys(_cg).length && now - _cgTs < 90000) return _cg;
  try {
    const r = await fetch(CG_URL, { headers: { Accept: 'application/json' } });
    const list = await r.json();
    if (Array.isArray(list)) {
      const m = {};
      list.forEach(c => {
        if (!(c.market_cap > MIN_CAP)) return;
        m[c.symbol.toUpperCase()] = {
          id: c.id, cap: c.market_cap, name: c.name, price: c.current_price,
          p1h:  c.price_change_percentage_1h_in_currency,
          p1d:  c.price_change_percentage_24h_in_currency,
          p7d:  c.price_change_percentage_7d_in_currency,
          p30d: c.price_change_percentage_30d_in_currency,
          p1y:  c.price_change_percentage_1y_in_currency,
        };
      });
      if (Object.keys(m).length) { _cg = m; _cgTs = now; }
    }
  } catch {}
  return _cg;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (_cache && now - _ts < 1000) {
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=3');
    return res.json(_cache);
  }

  const cg = await getCG();

  // Live Binance price overlay (best-effort)
  const bin = {};
  try {
    const r = await fetch(BIN_URL);
    const data = await r.json();
    if (Array.isArray(data)) {
      for (const d of data) {
        if (!d.symbol.endsWith('USDT')) continue;
        bin[d.symbol.slice(0, -4)] = { price: +d.lastPrice, p1d: +d.priceChangePercent };
      }
    }
  } catch {}

  const rows = [];
  for (const sym in cg) {
    const c = cg[sym];
    const b = bin[sym];
    rows.push({
      sym,
      id:    c.id,
      name:  c.name,
      cap:   c.cap,
      price: b?.price ?? c.price,
      p5m:   null,
      p1d:   b?.p1d ?? c.p1d,
      p1h:   c.p1h, p7d: c.p7d, p30d: c.p30d, p1y: c.p1y,
    });
  }

  // 5-minute rolling change — heavy Binance endpoint, so refresh at most every 10s
  // (top coins by cap only) and keep it cached so the column stays populated.
  if (now - _p5mTs > 10000) {
    try {
      const binSyms = rows.filter(r => bin[r.sym]).slice(0, 80).map(r => r.sym + 'USDT');
      const chunks = [];
      for (let i = 0; i < binSyms.length; i += 40) chunks.push(binSyms.slice(i, i + 40));
      const results = await Promise.all(chunks.map(ch =>
        fetch(`https://data-api.binance.vision/api/v3/ticker?symbols=${encodeURIComponent(JSON.stringify(ch))}&windowSize=5m`,
          { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => [])));
      const m = {};
      for (const arr of results) if (Array.isArray(arr)) for (const t of arr) m[t.symbol.slice(0, -4)] = +t.priceChangePercent;
      if (Object.keys(m).length) { _p5m = m; _p5mTs = now; }
    } catch {}
  }
  rows.forEach(r => { if (_p5m[r.sym] != null) r.p5m = _p5m[r.sym]; });

  const payload = { rows, ts: now };
  if (rows.length) { _cache = payload; _ts = now; }
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=3');
  res.json(payload);
}
