/**
 * scripts/healthcheck.mjs — daily data-feed health probe for BEEP AI.
 *
 * Checks every live feed/robot for: reachability (no timeout), freshness, and value
 * sanity (no NaN/0/null, prices in a plausible range). Writes a dated markdown report
 * to reports/healthcheck-YYYY-MM-DD.md and prints a summary. Exits non-zero only when a
 * CRITICAL feed (crypto price) fails, so CI flags real outages but not Yahoo rate-limits.
 *
 * Usage:
 *   node scripts/healthcheck.mjs                       # checks public sources only
 *   HEALTH_BASE=https://beep-ai.vercel.app node scripts/healthcheck.mjs   # + app endpoints
 *   node scripts/healthcheck.mjs --base http://localhost:5173
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Resolve base URL for app endpoints (optional).
const argBase = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null;
const BASE = (argBase || process.env.HEALTH_BASE || '').replace(/\/$/, '');

const TIMEOUT = 12000;
async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': 'BeepAI-Healthcheck/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const results = [];
async function probe({ name, group, critical = false, optional = false, run }) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, group, critical, optional, status: 'ok', ms: Date.now() - started, detail });
  } catch (e) {
    results.push({ name, group, critical, optional, status: optional ? 'warn' : 'fail', ms: Date.now() - started, detail: e.message });
  }
}

// ── Public sources (always checked, no app server needed) ─────────────────────
await probe({
  // Mirror, not api.binance.com — the latter is HTTP 451 from cloud/CI regions (geo-block).
  // The app's real crypto feed is a browser WebSocket (user IP); this server check uses the mirror.
  name: 'Binance BTCUSDT (price + volume)', group: 'Crypto', critical: true,
  run: async () => {
    const d = await getJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT');
    const price = parseFloat(d.lastPrice), qVol = parseFloat(d.quoteVolume);
    if (!Number.isFinite(price) || price < 1000 || price > 1e7) throw new Error(`BTC price out of range: ${d.lastPrice}`);
    if (!Number.isFinite(qVol) || qVol <= 0) throw new Error(`quoteVolume invalid: ${d.quoteVolume}`);
    return `BTC=$${price.toLocaleString()} · vol=$${(qVol / 1e9).toFixed(2)}B`;
  },
});
await probe({
  name: 'Crypto Fear & Greed (alternative.me)', group: 'Sentiment',
  run: async () => {
    const d = await getJson('https://api.alternative.me/fng/?limit=1');
    const v = parseInt(d?.data?.[0]?.value, 10);
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error(`F&G out of range: ${v}`);
    return `index=${v} (${d.data[0].value_classification})`;
  },
});

// ── App endpoints (only when a BASE url is provided) ──────────────────────────
if (BASE) {
  await probe({
    name: `${BASE}/api/health`, group: 'App', optional: true,
    run: async () => {
      // /api/health returns 503 (with a JSON body) when a critical feed is down; read
      // the body regardless of status. Note: its stock-proxy self-check only works on
      // Vercel (independent invocations) — under `vite dev` the self-fetch can't resolve.
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(TIMEOUT) });
      const d = await r.json().catch(() => ({}));
      return d.summary || (d.ok ? 'ok' : `degraded (HTTP ${r.status})`);
    },
  });
  await probe({
    name: `${BASE}/api/market?symbol=AAPL`, group: 'Stocks',
    run: async () => {
      const d = await getJson(`${BASE}/api/market?symbol=AAPL`);
      const p = parseFloat(d.price);
      if (!Number.isFinite(p) || p <= 0) throw new Error(`AAPL price missing (${d.error || 'null'})`);
      return `AAPL=$${p} ${d.stale ? `(last close · ${d.marketState})` : '(live)'}`;
    },
  });
  await probe({
    name: `${BASE}/api/tv-screener?period=1d`, group: 'Stocks',
    run: async () => {
      const d = await getJson(`${BASE}/api/tv-screener?period=1d`);
      const arr = Array.isArray(d) ? d : (d.quotes || d.stocks || d.data || []);
      if (!arr.length) throw new Error('empty screener result');
      return `${arr.length} gainers`;
    },
  });
  await probe({
    name: `${BASE}/api/crypto-gainers`, group: 'Crypto',
    run: async () => {
      const d = await getJson(`${BASE}/api/crypto-gainers`);
      const arr = Array.isArray(d) ? d : (d.rows || d.coins || d.data || []);
      if (!arr.length) throw new Error('empty gainers result');
      return `${arr.length} coins`;
    },
  });
  await probe({
    name: `${BASE}/api/finviz-model`, group: 'Stocks',
    run: async () => {
      const d = await getJson(`${BASE}/api/finviz-model`);
      if (!d.patterns || !d.total) throw new Error('no patterns/total');
      return `${d.total} stocks across ${d.patterns.length} patterns`;
    },
  });
  await probe({
    name: `${BASE}/api/fng-stocks`, group: 'Sentiment',
    run: async () => {
      const d = await getJson(`${BASE}/api/fng-stocks`);
      const v = parseInt(d?.value ?? d?.score ?? d?.fng, 10);
      if (!Number.isFinite(v)) throw new Error('no value');
      return `index=${v}`;
    },
  });
  await probe({
    name: `${BASE}/api/tgm-leads`, group: 'TGM', optional: true,
    run: async () => {
      const d = await getJson(`${BASE}/api/tgm-leads`);
      if (d.configured === false) throw new Error('Redis not configured (local/dev) — informational');
      const n = (d.leads || d.data || []).length;
      return `${n} leads stored`;
    },
  });
}

// ── Build the report ──────────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const icon = (s) => (s === 'ok' ? '✅' : s === 'warn' ? '⚠️' : '❌');
const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
const criticalFail = results.some(r => r.critical && r.status === 'fail');

let md = `# Healthcheck — ${dateStr}\n\n`;
md += `**זמן ריצה:** ${now.toISOString()}  \n`;
md += `**בסיס בדיקה (app):** ${BASE || '— (מקורות ציבוריים בלבד)'}  \n`;
md += `**תוצאה כוללת:** ${criticalFail ? '🔴 כשל קריטי' : '🟢 תקין'} — ` +
      `✅ ${counts.ok || 0} · ⚠️ ${counts.warn || 0} · ❌ ${counts.fail || 0}\n\n`;
md += `| סטטוס | פיד | קבוצה | זמן | פירוט |\n|---|---|---|---|---|\n`;
for (const r of results) {
  md += `| ${icon(r.status)}${r.critical ? ' 🔑' : ''} | ${r.name} | ${r.group} | ${r.ms}ms | ${String(r.detail).replace(/\|/g, '\\|')} |\n`;
}
md += `\n> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י \`scripts/healthcheck.mjs\`\n`;

const reportsDir = join(ROOT, 'reports');
mkdirSync(reportsDir, { recursive: true });
const outPath = join(reportsDir, `healthcheck-${dateStr}.md`);
writeFileSync(outPath, md, 'utf8');

console.log(md);
console.log(`\n📄 Report written: ${outPath}`);
process.exit(criticalFail ? 1 : 0);
