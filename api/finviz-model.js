/**
 * /api/finviz-model — Vercel serverless (was MISSING → FinvizPage live scan 404'd).
 *
 * Replicated from the BEEP BEEP parent app's api/finviz-scan.js fetch/score pattern,
 * but reshaped to the multi-pattern payload FinvizPage.jsx consumes:
 *   { total, scannedAt, criteria:{universe}, patterns:[{id,emoji,labelHe,color,confidence,
 *      stocks:[{ticker, price:Number, change:Number, rsi?, mcapFmt, score}]}] }
 *
 * Data sources (free, no key, server-side to dodge CORS):
 *   1. Yahoo Finance v7 quote (crumb+cookie session, includePrePost)
 *   2. Stooq.com CSV last-close fallback
 * Stocks are bucketed into bullish-momentum / oversold-bounce / volume-breakout /
 * bearish-reversal by their live day move + relative volume.
 */

const VOLATILE_STOCKS = [
  'NVDA','TSLA','AMD','PLTR','CRWD','NET','DDOG','ZS','SNOW','COIN',
  'MSTR','HOOD','AFRM','UPST','RIVN','LCID','NIO','SOFI',
  'MARA','RIOT','CLSK','HUT','SMCI','ARM',
  'AAPL','MSFT','META','AMZN','GOOGL',
  'PYPL','INTC','QCOM','MU','AVGO',
  'AMC','GME','DKNG','ABNB','UBER','SHOP',
];

const YF_FIELDS = [
  'symbol','shortName','marketCap',
  'regularMarketPrice','regularMarketChangePercent',
  'regularMarketVolume','averageDailyVolume3Month',
].join(',');

const BASE_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
};

// ── Yahoo crumb session ───────────────────────────────────────────────────────
let _crumb = null, _cookies = '', _crumbTs = 0;
async function getYahooSession() {
  if (_crumb && Date.now() - _crumbTs < 18 * 60 * 1000) return { crumb: _crumb, cookies: _cookies };
  try {
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: { ...BASE_HDR, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(7000),
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

async function fetchYahoo(symbols, session) {
  const syms = symbols.join(',');
  const crumbParam = session?.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
  const hdrs = session?.cookies ? { ...BASE_HDR, Cookie: session.cookies } : BASE_HDR;
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${syms}&fields=${YF_FIELDS}${crumbParam}`,
        { headers: hdrs, signal: AbortSignal.timeout(10000) }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const results = d?.quoteResponse?.result ?? [];
      if (results.length) return results;
    } catch { /* next host */ }
  }
  return [];
}

// ── Stooq fallback ────────────────────────────────────────────────────────────
async function fetchStooqChunk(chunk) {
  const syms = chunk.map(s => `${s}.US`).join('+');
  try {
    const r = await fetch(
      `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvp&h&e=csv`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return [];
    const lines = (await r.text()).trim().split('\n');
    if (lines.length < 2) return [];
    const hdr = lines[0].split(',').map(h => h.trim());
    const iSym = hdr.indexOf('Symbol'), iClose = hdr.indexOf('Close'),
          iVol = hdr.indexOf('Volume'), iPrev = hdr.indexOf('Prev');
    return lines.slice(1).map(line => {
      const p = line.split(',');
      const sym = (p[iSym] || '').replace('.US', '');
      const close = parseFloat(p[iClose]); const prev = parseFloat(p[iPrev]);
      const vol = parseInt(p[iVol] || '0', 10);
      if (!sym || !Number.isFinite(close) || close <= 0) return null;
      const chg = (Number.isFinite(prev) && prev > 0) ? ((close - prev) / prev) * 100 : 0;
      return {
        symbol: sym, shortName: sym, regularMarketPrice: close,
        regularMarketChangePercent: chg, regularMarketVolume: vol,
        averageDailyVolume3Month: 0, marketCap: 0,
      };
    }).filter(Boolean);
  } catch { return []; }
}
async function fetchStooq(symbols) {
  const CHUNK = 20; const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));
  return (await Promise.all(chunks.map(fetchStooqChunk))).flat();
}

// ── Yahoo v8 chart-meta fallback (single-symbol, very permissive) ──────────────
// Used when the v7 batch quote is rate-limited and Stooq is unreachable. Mirrors the
// resilient path that /api/market relies on. No marketCap / avg-volume, so relVol
// defaults to 1 and market cap shows "—" — price + change are still real.
async function fetchOneChart(sym) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`,
      { headers: BASE_HDR, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const meta = (await r.json())?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
    if (price == null || price <= 0) return null;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const chg = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol: sym, shortName: meta.shortName ?? sym,
      regularMarketPrice: price, regularMarketChangePercent: chg,
      regularMarketVolume: meta.regularMarketVolume ?? 0,
      averageDailyVolume3Month: 0, marketCap: 0,
    };
  } catch { return null; }
}
async function fetchYahooChartBatch(symbols) {
  const settled = await Promise.allSettled(symbols.map(fetchOneChart));
  return settled.map(s => (s.status === 'fulfilled' ? s.value : null)).filter(Boolean);
}

function fmtCap(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(0) + 'M';
  return '—';
}

// ── Pattern buckets ───────────────────────────────────────────────────────────
const PATTERNS = [
  { id: 'momentum', emoji: '🚀', labelHe: 'מומנטום שורי',  color: '#22c55e',
    match: (chg) => chg >= 2 },
  { id: 'bounce',   emoji: '🔵', labelHe: 'תיקון יתר (Bounce)', color: '#60a5fa',
    match: (chg) => chg <= -3 },
  { id: 'breakout', emoji: '📊', labelHe: 'פריצת וולום',    color: '#D4AF37',
    match: (chg, relVol) => Math.abs(chg) < 2 && relVol >= 1.3 },
  { id: 'bearish',  emoji: '🔻', labelHe: 'היפוך דובי',     color: '#ef4444',
    match: (chg) => chg >= 3 && chg <= 9 },
];

function scoreStock(chg, relVol, mc) {
  let s = 60;
  s += Math.min(Math.abs(chg) * 1.5, 12);
  if (relVol >= 3) s += 12; else if (relVol >= 2) s += 8; else if (relVol >= 1.3) s += 4;
  if (mc >= 200e9) s -= 8; else if (mc >= 10e9) s += 4; else if (mc >= 2e9) s += 2;
  return Math.min(Math.max(Math.round(s), 50), 92);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1) Yahoo, 2) Stooq fallback
  let raw = [];
  const session = await getYahooSession();
  raw = await fetchYahoo(VOLATILE_STOCKS, session);
  if (!raw.length) raw = await fetchYahoo(VOLATILE_STOCKS, null);
  if (!raw.length) raw = await fetchStooq(VOLATILE_STOCKS);
  if (!raw.length) raw = await fetchYahooChartBatch(VOLATILE_STOCKS);

  if (!raw.length) {
    return res.status(503).json({
      ok: false, error: 'Data sources unavailable',
      total: 0, scannedAt: Date.now(), patterns: [], criteria: { universe: 'US volatile' },
    });
  }

  // Normalize + score + bucket
  const buckets = Object.fromEntries(PATTERNS.map(p => [p.id, []]));
  for (const q of raw) {
    const price = q.regularMarketPrice;
    if (price == null || price <= 0) continue;
    const chg = q.regularMarketChangePercent ?? 0;
    const vol = q.regularMarketVolume ?? 0;
    const avg = q.averageDailyVolume3Month || 0;
    const relVol = avg > 0 ? vol / avg : 1;
    const mc = q.marketCap ?? 0;

    const pat = PATTERNS.find(p => p.match(chg, relVol));
    if (!pat) continue;

    buckets[pat.id].push({
      ticker: q.symbol,
      price: Number(price),
      change: Number(chg.toFixed(2)),
      mcapFmt: fmtCap(mc),
      relVol: avg > 0 ? Number(relVol.toFixed(1)) : null,
      score: scoreStock(chg, relVol, mc),
    });
  }

  const patterns = PATTERNS.map(p => {
    const stocks = buckets[p.id].sort((a, b) => b.score - a.score).slice(0, 8);
    if (!stocks.length) return null;
    const confidence = Math.round(stocks.reduce((s, x) => s + x.score, 0) / stocks.length);
    return { id: p.id, emoji: p.emoji, labelHe: p.labelHe, color: p.color, confidence, stocks };
  }).filter(Boolean);

  const total = patterns.reduce((s, p) => s + p.stocks.length, 0);

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return res.json({
    ok: true, total, scannedAt: Date.now(),
    criteria: { universe: 'US volatile (Yahoo/Stooq)' },
    patterns,
  });
}
