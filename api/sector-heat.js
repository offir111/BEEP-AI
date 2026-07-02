/**
 * /api/sector-heat — ציון "חום" 0–100 לכל סקטור, מנתונים אמיתיים חיים.
 *
 * מקור: Finviz Groups (groups.ashx?g=sector&v=140) — ביצועי 11 הסקטורים
 * (Week/Month/Quarter/Half/Year/YTD/Change). ציון = מומנטום משוקלל
 * (50% רבעון + 30% חודש + 20% שבוע), מנורמל 0–100 כשהחם ביותר = 100.
 * רמזור: green ≥66 · amber 34–65 · red ≤33. cache 15 דק'.
 * עוטף ב-try/catch — לעולם לא זורק; live=false אם המקור נפל.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SECTORS = [
  'Basic Materials', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive',
  'Energy', 'Financial', 'Healthcare', 'Industrials', 'Real Estate', 'Technology', 'Utilities',
];

const tierOf = (s) => (s >= 66 ? 'green' : s >= 34 ? 'amber' : 'red');

async function fetchGroups() {
  for (const host of ['finviz.com', 'www.finviz.com']) {
    try {
      const r = await fetch(`https://${host}/groups.ashx?g=sector&v=140`, {
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
        redirect: 'follow', signal: AbortSignal.timeout(11000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      if (html.length > 8000) return html;
    } catch { /* next host */ }
  }
  return null;
}

/* מחלץ לכל סקטור [week, month, quarter] מטבלת הביצועים. */
function parsePerf(html) {
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const out = {};
  for (const s of SECTORS) {
    let idx = 0;
    while ((idx = txt.indexOf(s, idx)) !== -1) {
      const seg = txt.slice(idx + s.length, idx + s.length + 160);
      const nums = seg.match(/-?\d+\.\d+%/g);
      if (nums && nums.length >= 5) {
        out[s] = {
          week: parseFloat(nums[0]),
          month: parseFloat(nums[1]),
          quarter: parseFloat(nums[2]),
        };
        break;
      }
      idx += s.length;
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800'); // 15 min
  if (req.method === 'OPTIONS') return res.status(200).end();

  const html = await fetchGroups();
  const perf = html ? parsePerf(html) : {};
  const names = Object.keys(perf);

  if (names.length < 5) {
    return res.status(200).json({ sectors: {}, live: false, fetchedAt: new Date().toISOString() });
  }

  // מומנטום משוקלל + נרמול 0–100 (החם ביותר = 100)
  const metric = {};
  for (const n of names) {
    const p = perf[n];
    metric[n] = 0.5 * p.quarter + 0.3 * p.month + 0.2 * p.week;
  }
  const vals = Object.values(metric);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min;

  const sectors = {};
  for (const n of names) {
    const score = span > 0 ? Math.round(((metric[n] - min) / span) * 100) : 50;
    sectors[n] = { score, tier: tierOf(score), perf: perf[n] };
  }

  return res.status(200).json({ sectors, live: true, fetchedAt: new Date().toISOString() });
}
