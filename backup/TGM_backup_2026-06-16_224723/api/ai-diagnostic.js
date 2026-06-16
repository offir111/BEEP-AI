// /api/ai-diagnostic.js — Vercel Serverless Function
// Generates a Hebrew AI-style summary from top3 scan results
// No external AI API needed — uses template-based analysis

function signalHe(signal) {
  const map = {
    'STRONG BUY':  'קנייה חזקה מאוד',
    'BUY':         'קנייה',
    'HOLD':        'המתנה',
    'SELL':        'מכירה',
    'STRONG SELL': 'מכירה חזקה',
  };
  return map[signal] || signal;
}

function buildSummary(top3) {
  if (!top3 || top3.length === 0) return '';

  const leader = top3[0];
  const up = leader.change >= 0;

  const lines = [];

  // Lead sentence
  if (leader.score >= 70) {
    lines.push(`📈 ${leader.name} (${leader.symbol}) בולט היום עם שינוי של ${leader.change > 0 ? '+' : ''}${leader.change}% — סיגנל ${signalHe(leader.signal)}.`);
  } else if (leader.score >= 50) {
    lines.push(`📊 ${leader.name} (${leader.symbol}) מציג מומנטום ניטרלי-חיובי, שינוי ${leader.change > 0 ? '+' : ''}${leader.change}%.`);
  } else {
    lines.push(`📉 הסריקה מגלה לחץ מכירה — ${leader.name} (${leader.symbol}) ירד ${Math.abs(leader.change)}%.`);
  }

  // Sector overview
  const bullish = top3.filter(t => t.signal === 'BUY' || t.signal === 'STRONG BUY').length;
  const bearish = top3.filter(t => t.signal === 'SELL' || t.signal === 'STRONG SELL').length;

  if (bullish === 3) {
    lines.push('🟢 שלושת המניות המובילות נמצאות במגמת עלייה — סנטימנט שוק חיובי.');
  } else if (bearish >= 2) {
    lines.push('🔴 רוב המניות המובילות בלחץ — שים לב לניהול סיכונים.');
  } else if (bullish >= 2) {
    lines.push('🟡 רוב המניות מראות מומנטום חיובי עם חריג אחד.');
  } else {
    lines.push('⚪ שוק מעורב — אין כיוון ברור, המתן לפריצה ברורה.');
  }

  // Score context
  const avgScore = Math.round(top3.reduce((s, t) => s + t.score, 0) / top3.length);
  if (avgScore >= 65) {
    lines.push(`ציון ממוצע שוק: ${avgScore}/100 — תנאים טובים לאסטרטגיות Momentum.`);
  } else if (avgScore >= 45) {
    lines.push(`ציון ממוצע שוק: ${avgScore}/100 — סביבה ניטרלית, העדף מניות עם נפח גבוה.`);
  } else {
    lines.push(`ציון ממוצע שוק: ${avgScore}/100 — שוק חלש, שקול הגנות או המתנה.`);
  }

  return lines.join(' ');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const top3 = body?.top3 || [];
    const summary = buildSummary(top3);
    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(200).json({ summary: '' });
  }
}
