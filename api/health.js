// /api/health — runtime health endpoint for the BEEP AI data feeds.
// Server-side checks (no CORS issues): each feed is probed for reachability,
// freshness, and value sanity. Returns 200 when all critical feeds are OK,
// 503 when a critical feed is down — so Vercel/Railway/uptime monitors can alert.
//
//   GET /api/health           → JSON summary
//   GET /api/health?verbose=1 → include raw sample values

async function check(name, critical, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    return { name, critical, ok: true, ms: Date.now() - started, ...detail };
  } catch (e) {
    return { name, critical, ok: false, ms: Date.now() - started, error: e.message };
  }
}

// Binance — crypto price + volume sanity (BTC should be a plausible number).
// NOTE: use the data-api.binance.vision mirror, not api.binance.com — the latter returns
// HTTP 451 from Vercel's server region (geo-block). The app's live feed is a *browser*
// WebSocket (user IP, not blocked); this server-side check must use the reachable mirror.
async function checkBinance() {
  const r = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT', {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const price = parseFloat(d.lastPrice);
  const qVol = parseFloat(d.quoteVolume);
  if (!Number.isFinite(price) || price < 1000 || price > 10_000_000)
    throw new Error(`BTC price out of sane range: ${d.lastPrice}`);
  if (!Number.isFinite(qVol) || qVol <= 0)
    throw new Error(`BTC quote volume invalid: ${d.quoteVolume}`);
  return { value: { btc: price, quoteVolume: qVol } };
}

// Crypto Fear & Greed — alternative.me.
async function checkFng() {
  const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const v = parseInt(d?.data?.[0]?.value, 10);
  if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error(`F&G out of range: ${v}`);
  return { value: { fng: v } };
}

// Stock proxy — our own /api/market must return a usable AAPL price (live or last close).
async function checkMarket(origin) {
  const r = await fetch(`${origin}/api/market?symbol=AAPL`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d.price == null || !Number.isFinite(parseFloat(d.price)) || parseFloat(d.price) <= 0)
    throw new Error(`AAPL price missing/invalid (${d.error || 'no price'})`);
  return { value: { aapl: parseFloat(d.price), stale: !!d.stale, marketState: d.marketState } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Derive our own origin so the stock-proxy self-check hits this deployment.
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
  const origin = `${proto}://${host}`;

  const checks = await Promise.all([
    check('binance_crypto', true,  checkBinance),
    check('fear_greed',     false, checkFng),
    check('stock_proxy',    true,  () => checkMarket(origin)),
  ]);

  const criticalDown = checks.some(c => c.critical && !c.ok);
  const okCount = checks.filter(c => c.ok).length;

  if (!req.query?.verbose) checks.forEach(c => { delete c.value; });

  res.status(criticalDown ? 503 : 200).json({
    ok: !criticalDown,
    summary: `${okCount}/${checks.length} feeds healthy`,
    ts: new Date().toISOString(),
    checks,
  });
}
