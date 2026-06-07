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

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 BEEP AI running on port ${PORT}`);
});
