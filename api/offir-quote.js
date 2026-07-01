/**
 * /api/offir-quote?symbol=CIFR&type=STOCK
 *
 * נקודת-קצה ייעודית לרובוט +OFFIR בלבד (בידוד — אינה נוגעת ב-stock-detail / market
 * המשותפים). מספקת את הנתונים הפונדמנטליים שחסרים ל-6 קריטריוני הסינון:
 *   • market_cap  ← Finviz (snapshot "Market Cap")            → קריטריון 1
 *   • sector      ← Finviz (f=sec_…) + industry (f=ind_…)     → קריטריון 2 (סקטור חם)
 *   • price       ← Yahoo v8 chart meta (regularMarketPrice)  → תווית LIVE
 *   • week52High  ← Yahoo v8 chart meta (fiftyTwoWeekHigh)     → גיבוי לקריטריון 6
 *
 * נרות ה-TA (מגמה/תנודתיות/ירידה-מהשיא) מגיעים בנפרד מ-/api/candles.
 * כל מקור עוטף ב-try/catch ומחזיר null — לעולם לא זורק; השדה מסומן unknown ב-UI.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SUFFIX = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/* "10.16B" / "742.50M" → number ; "-" / "" → null */
function parseAbbrevNum(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMBT])?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2] ? SUFFIX[m[2].toUpperCase()] : 1;
  return n * mult;
}

const TITLE = (s) =>
  String(s || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* Finviz snapshot cell: >LABEL< … snapshot-td-content">VALUE</td> (strips inner tags). */
function snapshotField(html, label) {
  const i = html.indexOf('>' + label + '<');
  if (i === -1) return null;
  const seg = html.slice(i, i + 340);
  const m = seg.match(/snapshot-td-content">([\s\S]*?)<\/td>/);
  if (!m) return null;
  const txt = m[1].replace(/<[^>]+>/g, '').trim();
  return txt && txt !== '-' ? txt : null;
}
const toNum = (s) => {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[%,]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const decodeEntities = (s) =>
  String(s)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

/* Finviz news-table → [{ title, url, date }]. Real Yahoo/Finviz headlines, capped. */
function parseNews(html, cap = 8) {
  const t = html.match(/id="news-table"[\s\S]*?<\/table>/);
  if (!t) return [];
  const rows = t[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const out = [];
  for (const r of rows) {
    const a = r.match(/href="([^"]+)"[^>]*class="tab-link-news"|class="tab-link-news"[^>]*href="([^"]+)"/);
    const am = r.match(/<a[^>]*class="tab-link-news"[^>]*>([\s\S]*?)<\/a>/);
    const href = a ? (a[1] || a[2]) : (r.match(/href="([^"]+)"/) || [])[1];
    if (!am || !href) continue;
    const title = decodeEntities(am[1].replace(/<[^>]+>/g, '')).trim();
    const dm = r.match(/<td[^>]*width="130"[^>]*>\s*([A-Za-z0-9:\- ]+?)\s*<\/td>/);
    if (title) out.push({ title, url: href, date: dm ? dm[1].trim() : null });
    if (out.length >= cap) break;
  }
  return out;
}

/* ── Finviz snapshot: market cap + sector + industry ─────────────── */
async function fetchFinviz(symbol) {
  try {
    const r = await fetch(`https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(11000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    if (html.length < 5000) return null;

    // Market Cap — first number+suffix following the "Market Cap" label cell.
    let marketCap = null;
    const idx = html.indexOf('Market Cap');
    if (idx !== -1) {
      const seg = html.slice(idx, idx + 260);
      const mc = seg.match(/>\s*([0-9]+(?:\.[0-9]+)?[KMBT])\s*</);
      if (mc) marketCap = parseAbbrevNum(mc[1]);
    }

    const secM = html.match(/f=sec_([a-z]+)/i);
    const indM = html.match(/f=ind_([a-z]+)/i);
    const sector = secM ? TITLE(secM[1]) : null;
    const industry = indM ? TITLE(indM[1]) : null;

    // Conviction-layer fields (Stage 3) — all real Finviz snapshot values.
    const analystRecom = toNum(snapshotField(html, 'Recom'));       // 1..5 (≤2 = Buy)
    const targetPrice  = toNum(snapshotField(html, 'Target Price'));
    const instOwn      = toNum(snapshotField(html, 'Inst Own'));     // %
    const relVolume    = toNum(snapshotField(html, 'Rel Volume'));
    const avgVolume    = parseAbbrevNum(snapshotField(html, 'Avg Volume'));
    const headlines    = parseNews(html);

    return { marketCap, sector, industry, analystRecom, targetPrice, instOwn, relVolume, avgVolume, headlines };
  } catch {
    return null;
  }
}

/* ── Yahoo v8 chart meta: price + 52-week high/low (no crumb needed) ─ */
async function fetchYahooMeta(symbol) {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(9000) }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const m = d?.chart?.result?.[0]?.meta;
      if (!m) continue;
      return {
        price: Number.isFinite(m.regularMarketPrice) ? m.regularMarketPrice : null,
        week52High: Number.isFinite(m.fiftyTwoWeekHigh) ? m.fiftyTwoWeekHigh : null,
        week52Low: Number.isFinite(m.fiftyTwoWeekLow) ? m.fiftyTwoWeekLow : null,
        name: m.shortName || m.longName || null,
      };
    } catch {
      /* next host */
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query?.symbol || '').trim().toUpperCase();
  const type = (req.query?.type || 'STOCK').toUpperCase() === 'ETF' ? 'ETF' : 'STOCK';
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const [fv, ym] = await Promise.all([fetchFinviz(symbol), fetchYahooMeta(symbol)]);

  // For ETFs Finviz exposes no market cap (funds report AUM) — null is correct, not an error.
  const marketCap = fv?.marketCap ?? null;
  const sector = fv?.sector ?? null;
  const industry = fv?.industry ?? null;
  const price = ym?.price ?? null;
  const week52High = ym?.week52High ?? null;
  const week52Low = ym?.week52Low ?? null;

  // "live" = at least one real upstream field came back (price drives the LIVE badge).
  const fundamentalsLive = !!(fv && (marketCap != null || sector != null));
  const priceLive = price != null;

  return res.status(200).json({
    symbol,
    type,
    marketCap,
    sector,
    industry,
    price,
    week52High,
    week52Low,
    name: ym?.name || null,
    // Conviction layer (Stage 3) — additive, backward compatible.
    analystRecom: fv?.analystRecom ?? null,
    targetPrice:  fv?.targetPrice ?? null,
    instOwn:      fv?.instOwn ?? null,
    relVolume:    fv?.relVolume ?? null,
    avgVolume:    fv?.avgVolume ?? null,
    headlines:    fv?.headlines ?? [],
    fundamentalsLive,
    priceLive,
    fetchedAt: new Date().toISOString(),
  });
}
