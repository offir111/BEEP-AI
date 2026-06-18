/**
 * /api/fng-stocks — CNN Fear & Greed (stock market), server-side (avoids browser CORS)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  try {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' },
    });
    const d = await r.json();
    const score  = d?.fear_and_greed?.score;
    const rating = d?.fear_and_greed?.rating;
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.json({ score: score != null ? Math.round(score) : null, rating: rating || null });
  } catch (e) {
    res.status(500).json({ score: null, rating: null, error: e.message });
  }
}
