import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Serve static React build ──────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'BEEP AI', version: '1.0.0' });
});

// ── Market price proxy (fixes CORS from Yahoo Finance) ────────
app.get('/api/market', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    if (closes.length < 2) return res.json({ price: null, change: null });
    const prev  = closes[closes.length - 2];
    const curr  = closes[closes.length - 1];
    const price  = parseFloat(curr.toFixed(2));
    const change = parseFloat(((curr - prev) / prev * 100).toFixed(2));
    res.json({ price, change, symbol, updated: Date.now() });
  } catch (e) {
    res.status(500).json({ error: 'fetch failed', detail: e.message });
  }
});

// ── Admin PIN check (PIN stored in env var ADMIN_PIN) ─────────
app.post('/api/admin-check', (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.ADMIN_PIN || '12345678';
  if (pin === correctPin) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// ── Smart Scan — SOT ─────────────────────────────────────────
const SCAN_SYMBOLS = [
  {sym:'NVDA',    name:'NVIDIA',    type:'stock'},
  {sym:'AAPL',    name:'Apple',     type:'stock'},
  {sym:'TSLA',    name:'Tesla',     type:'stock'},
  {sym:'MSFT',    name:'Microsoft', type:'stock'},
  {sym:'GOOGL',   name:'Alphabet',  type:'stock'},
  {sym:'AMZN',    name:'Amazon',    type:'stock'},
  {sym:'META',    name:'Meta',      type:'stock'},
  {sym:'AMD',     name:'AMD',       type:'stock'},
  {sym:'BTC-USD', name:'Bitcoin',   type:'crypto'},
  {sym:'ETH-USD', name:'Ethereum',  type:'crypto'},
  {sym:'SOL-USD', name:'Solana',    type:'crypto'},
];

app.get('/api/scan', async (req, res) => {
  const { symbol: extra } = req.query; // optional extra symbol from user input
  let symbols = [...SCAN_SYMBOLS];
  if (extra) {
    const up = extra.toUpperCase();
    if (!symbols.find(s => s.sym === up)) {
      symbols.push({ sym: up, name: up, type: 'custom' });
    }
  }

  const results = await Promise.allSettled(symbols.map(async ({ sym, name, type }) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=7d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    const closes  = (result?.indicators?.quote?.[0]?.close  || []).filter(Boolean);
    const volumes = (result?.indicators?.quote?.[0]?.volume || []).filter(Boolean);
    if (closes.length < 2) return null;

    const curr = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const change1d = (curr - prev) / prev * 100;

    let score = 50;
    score += change1d * 3;
    if (closes.length >= 5) {
      const weekChange = (curr - closes[0]) / closes[0] * 100;
      score += weekChange * 1.5;
    }
    if (volumes.length >= 2) {
      const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
      const lastVol = volumes[volumes.length - 1];
      if (lastVol > avgVol * 1.5) score += 10;
      if (lastVol > avgVol * 2.0) score += 5;
    }
    // Consecutive up days
    let upDays = 0;
    for (let i = closes.length - 1; i > 0; i--) {
      if (closes[i] > closes[i - 1]) upDays++; else break;
    }
    score += upDays * 3;

    score = Math.max(0, Math.min(100, Math.round(score)));
    const signal =
      score >= 78 ? 'STRONG BUY' :
      score >= 60 ? 'BUY' :
      score >= 42 ? 'HOLD' :
      score >= 25 ? 'SELL' : 'STRONG SELL';

    return { symbol: sym.replace('-USD',''), name, type, price: parseFloat(curr.toFixed(2)), change: parseFloat(change1d.toFixed(2)), score, signal };
  }));

  const valid = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .sort((a, b) => b.score - a.score);

  res.json({ results: valid, top3: valid.slice(0, 3), updated: Date.now() });
});

// ── AI Diagnostic (Groq if available, else algo summary) ──────
app.post('/api/ai-diagnostic', async (req, res) => {
  const { top3 } = req.body;
  const key = process.env.GROQ_API_KEY;
  if (!key || !top3?.length) {
    // Fallback: algorithmic summary
    const items = (top3 || []).map(s =>
      `${s.name} (${s.symbol}): Score ${s.score}/100 | ${s.change > 0 ? '+' : ''}${s.change}% | ${s.signal}`
    ).join('\n');
    return res.json({ summary: `📊 ניתוח אלגוריתמי יומי:\n\n${items}\n\n🎯 ממוצע ציון: ${top3 ? Math.round(top3.reduce((a,b)=>a+b.score,0)/top3.length) : 0}/100` });
  }
  try {
    const prompt = `אתה אנליסט שוק מקצועי. ניתח את התוצאות הבאות ותן המלצה קצרה בעברית (3-4 משפטים):\n${top3.map(s=>`${s.name}: ${s.change>0?'+':''}${s.change}% | Score ${s.score} | ${s.signal}`).join('\n')}\nתפקוס בהזדמנויות ובסיכונים העיקריים.`;
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
    });
    const d = await r.json();
    res.json({ summary: d.choices?.[0]?.message?.content || 'לא זמין' });
  } catch (e) {
    res.json({ summary: 'שגיאה בחיבור ל-AI — נסה שוב' });
  }
});

// ── FINVIZ Model — TradingView Pattern Scanner ────────────────
let _fvCache = null, _fvCacheTs = 0;
const FV_CACHE_MS = 60 * 60 * 1000; // 1 hour
const TV_SCAN_URL = 'https://scanner.tradingview.com/america/scan';
const TV_COLS = ['name','description','sector','close','change','RSI','market_cap_calc','average_volume_10d_calc','Recommend.All','Recommend.MA','Recommend.Other'];
const TV_BASE = [
  { left:'type',    operation:'equal',    right:'stock' },
  { left:'subtype', operation:'in_range', right:['common','foreign-issuer'] },
  { left:'market_cap_calc',         operation:'greater', right:2_000_000_000 },
  { left:'average_volume_10d_calc', operation:'greater', right:500_000 },
];
const TV_PATTERNS = [
  { id:'double_bottom',      label:'Double Bottom',      labelHe:'תחתית כפולה (W)',      confidence:88, emoji:'📈', color:'#4ade80', upsideMin:20, upsideMax:40, desc:'מניה שנגעה בתחתית פעמיים — היפוך עלייה קלאסי',
    extra:[{left:'RSI',operation:'in_range',right:[30,52]},{left:'Recommend.Other',operation:'greater',right:0.05},{left:'Recommend.All',operation:'in_range',right:[-0.2,0.65]}] },
  { id:'inverse_hs',         label:'Inverse H&S',        labelHe:'ראש וכתפיים הפוך',     confidence:89, emoji:'🔄', color:'#60a5fa', upsideMin:25, upsideMax:45, desc:'תבנית היפוך עולה — ראש נמוך בין שתי כתפיים',
    extra:[{left:'RSI',operation:'in_range',right:[40,58]},{left:'Recommend.All',operation:'in_range',right:[0.15,0.75]},{left:'Recommend.MA',operation:'greater',right:0.2}] },
  { id:'ascending_triangle', label:'Ascending Triangle', labelHe:'משולש עולה',           confidence:83, emoji:'▲',  color:'#fbbf24', upsideMin:15, upsideMax:35, desc:'תמיכה עולה + חסימה אופקית — פריצה ממשמשת',
    extra:[{left:'RSI',operation:'in_range',right:[50,65]},{left:'Recommend.MA',operation:'greater',right:0.5},{left:'Recommend.All',operation:'greater',right:0.4}] },
];

async function tvPatternScan(pattern) {
  const res = await fetch(TV_SCAN_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ filter:[...TV_BASE,...pattern.extra], options:{lang:'en'}, symbols:{query:{types:['stock']},tickers:[]}, columns:TV_COLS, sort:{sortBy:'Recommend.All',sortOrder:'desc'}, range:[0,20] }),
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  const json = await res.json();
  return (json.data || []).map(({s,d}) => {
    const mcap = d[6]||0;
    return { ticker:s.split(':')[1]||s, company:(d[1]||'').slice(0,28), sector:d[2]||'', price:d[3]||0, change:d[4]!=null?+Number(d[4]).toFixed(2):0, rsi:d[5]!=null?+Number(d[5]).toFixed(1):null,
      mcap, mcapFmt: mcap>=1e12?`${(mcap/1e12).toFixed(1)}T`:mcap>=1e9?`${(mcap/1e9).toFixed(1)}B`:`${(mcap/1e6).toFixed(0)}M`,
      score:d[8]!=null?+Number(d[8]).toFixed(3):0 };
  });
}

app.get('/api/finviz-model', async (req, res) => {
  const now = Date.now();
  if (_fvCache && now - _fvCacheTs < FV_CACHE_MS && !req.query.force)
    return res.json({ ..._fvCache, fromCache:true });
  try {
    const results = await Promise.allSettled(TV_PATTERNS.map(p => tvPatternScan(p)));
    const patterns = TV_PATTERNS.map((p,i) => ({
      ...p, extra:undefined,
      stocks: results[i].status==='fulfilled' ? results[i].value : [],
      error:  results[i].status!=='fulfilled' ? (results[i].reason?.message||'שגיאה') : null,
    }));
    const payload = { patterns, total:patterns.reduce((s,p)=>s+p.stocks.length,0), scannedAt:new Date().toISOString(),
      criteria:{marketCap:'$2B+',volume:'500K+',rsi:'30–65',universe:'כל הבורסה האמריקאית'} };
    _fvCache=payload; _fvCacheTs=now;
    res.json(payload);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 BEEP AI running on port ${PORT}`);
});
