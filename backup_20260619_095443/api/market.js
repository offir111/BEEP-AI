// /api/market.js — Vercel Serverless Function
// Returns a live (or last-close) price for any Yahoo symbol (AAPL, GC=F, ^GSPC, …).
// Called by LiveQuoteContext stock-poll, AlertsContext, ChartsPage, EtoroPage, ModelSmcPage.
//
// Robustness model (replicated from the BEEP BEEP parent app's api/quotes.js):
//   1. Yahoo Finance v7 quote WITH a crumb+cookie session and includePrePost
//   2. Yahoo Finance v8 chart meta (more permissive, no auth)
//   3. Stooq.com free CSV last-close  (US equities only — guarantees a price when closed)
// The response always carries `stale` (true = last close, market not open) and
// `marketState` so the UI can show 🟢 live vs a muted "last close" instead of an
// infinite skeleton.

const BASE_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
};

const YF_FIELDS = [
  'regularMarketPrice', 'regularMarketChangePercent',
  'regularMarketDayHigh', 'regularMarketDayLow', 'regularMarketVolume',
  'regularMarketPreviousClose', 'marketState', 'shortName',
  'preMarketPrice', 'preMarketChangePercent',
  'postMarketPrice', 'postMarketChangePercent',
].join(',');

// ── Yahoo crumb+cookie session (cached ~18 min) ───────────────────────────────
let _crumb = null, _cookies = '', _crumbTs = 0;

async function getYahooSession() {
  if (_crumb && Date.now() - _crumbTs < 18 * 60 * 1000) return { crumb: _crumb, cookies: _cookies };
  try {
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: { ...BASE_HDR, Accept: 'text/html,*/*' },
      redirect: 'follow', signal: AbortSignal.timeout(7000),
    });
    const raw = r1.headers.get('set-cookie') || '';
    const cookieStr = raw.split(/,(?=[A-Za-z_])/g).map(c => c.trim().split(';')[0]).join('; ');
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...BASE_HDR, Cookie: cookieStr }, signal: AbortSignal.timeout(4000),
    });
    const crumb = (await r2.text()).trim();
    if (crumb && crumb.length >= 3 && !crumb.startsWith('<')) {
      _crumb = crumb; _cookies = cookieStr; _crumbTs = Date.now();
      return { crumb, cookies: cookieStr };
    }
  } catch { /* fall through */ }
  return null;
}

// Resolve the displayable price from a Yahoo v7 quote, preferring the *live* session.
function pickFromQuote(q, symbol) {
  if (!q) return null;
  const state = q.marketState || null;
  // During post/pre sessions Yahoo keeps regularMarketPrice frozen at the close,
  // so prefer the session price when present.
  if (state === 'POST' && q.postMarketPrice != null) {
    return { price: q.postMarketPrice, change: q.postMarketChangePercent ?? q.regularMarketChangePercent ?? null,
             high: q.regularMarketDayHigh ?? null, low: q.regularMarketDayLow ?? null,
             volume: q.regularMarketVolume ?? null, name: q.shortName ?? symbol, stale: false, marketState: 'POST' };
  }
  if (state === 'PRE' && q.preMarketPrice != null) {
    return { price: q.preMarketPrice, change: q.preMarketChangePercent ?? null,
             high: q.regularMarketDayHigh ?? null, low: q.regularMarketDayLow ?? null,
             volume: q.regularMarketVolume ?? null, name: q.shortName ?? symbol, stale: false, marketState: 'PRE' };
  }
  if (q.regularMarketPrice != null) {
    return { price: q.regularMarketPrice, change: q.regularMarketChangePercent ?? null,
             high: q.regularMarketDayHigh ?? null, low: q.regularMarketDayLow ?? null,
             volume: q.regularMarketVolume ?? null, name: q.shortName ?? symbol,
             stale: state !== 'REGULAR', marketState: state || 'CLOSED' };
  }
  if (q.regularMarketPreviousClose != null) {
    return { price: q.regularMarketPreviousClose, change: null,
             high: null, low: null, volume: null, name: q.shortName ?? symbol,
             stale: true, marketState: 'CLOSED' };
  }
  return null;
}

async function tryYahooV7(symbol, session) {
  const crumbParam = session?.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
  const hdrs = session?.cookies ? { ...BASE_HDR, Cookie: session.cookies } : BASE_HDR;
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=${YF_FIELDS}&includePrePost=true${crumbParam}`,
        { headers: hdrs, signal: AbortSignal.timeout(8000) }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const q = data?.quoteResponse?.result?.[0];
      const picked = pickFromQuote(q, symbol);
      if (picked) return picked;
    } catch { /* try next host */ }
  }
  return null;
}

// v8 chart meta — no auth, often works when v7 is rate-limited.
async function tryYahooChart(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: BASE_HDR, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
    if (price == null) return null;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const change = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : null;
    return {
      price, change, high: meta.regularMarketDayHigh ?? null, low: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null, name: meta.shortName ?? symbol,
      stale: (meta.marketState && meta.marketState !== 'REGULAR') || meta.regularMarketPrice == null,
      marketState: meta.marketState || 'CLOSED',
    };
  } catch { return null; }
}

// Stooq last-close CSV — US equities only (plain 1-5 letter tickers). Guarantees a price.
async function tryStooq(symbol) {
  if (!/^[A-Z]{1,5}$/.test(symbol)) return null;   // skip indices (^GSPC), futures (GC=F), FX
  try {
    const r = await fetch(
      `https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcvp&h&e=csv`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const text = await r.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const hdr = lines[0].split(',').map(h => h.trim());
    const p = lines[1].split(',');
    const iClose = hdr.indexOf('Close'), iPrev = hdr.indexOf('Prev'),
          iVol = hdr.indexOf('Volume'), iHigh = hdr.indexOf('High'), iLow = hdr.indexOf('Low');
    const close = parseFloat(p[iClose]);
    if (!Number.isFinite(close) || close <= 0) return null;
    const prev = parseFloat(p[iPrev]);
    const change = (Number.isFinite(prev) && prev > 0) ? ((close - prev) / prev) * 100 : null;
    return {
      price: close, change,
      high: Number.isFinite(parseFloat(p[iHigh])) ? parseFloat(p[iHigh]) : null,
      low:  Number.isFinite(parseFloat(p[iLow]))  ? parseFloat(p[iLow])  : null,
      volume: parseInt(p[iVol] || '0', 10) || null,
      name: symbol, stale: true, marketState: 'CLOSED',
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required', price: null });

  try {
    const session = await getYahooSession();
    let result = await tryYahooV7(symbol, session);
    if (!result) result = await tryYahooV7(symbol, null);
    if (!result) result = await tryYahooChart(symbol);
    if (!result) result = await tryStooq(symbol);

    if (result?.price != null) {
      return res.status(200).json({
        price: parseFloat(result.price),
        changePercent: result.change ?? null,
        change: result.change ?? null,
        high: result.high ?? null,
        low: result.low ?? null,
        volume: result.volume ?? null,
        name: result.name ?? symbol,
        marketState: result.marketState ?? null,
        stale: !!result.stale,
        symbol,
      });
    }

    // Genuinely no data anywhere.
    return res.status(200).json({ price: null, symbol, error: 'no_data' });
  } catch (err) {
    return res.status(200).json({ price: null, symbol, error: err.message });
  }
}
