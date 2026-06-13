/**
 * BubbleChart.jsx — cryptobubbles.net clone
 * Assets: crypto (CoinGecko) | stocks (TradingView) | favorites (personal)
 * Signal filters: 🔥 VOL | 💥 BREAK | 🚀 MOM
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import './BubbleChart.css';
import BubbleDetail from './BubbleDetail';
import { getFavorites, isFavorite } from '../utils/favorites.js';

/* ── Constants ─────────────────────────────────────────────── */
const CRYPTO_TABS = [
  { id: '1h',  label: '1H' },
  { id: '24h', label: '1D' },
  { id: '7d',  label: '1W' },
  { id: '30d', label: '1M' },
  { id: '1y',  label: '1Y' },
];
const STOCK_TABS = [
  { id: '1d', label: '1D' },   // no real 1H from TradingView scanner
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
  { id: '1y', label: '1Y' },
];
const CAP_OPTS = [
  { id: 'all',  label: 'הכל'  },
  { id: '10m',  label: '10M'  },
  { id: '100m', label: '100M' },
  { id: '1b',   label: '1B'   },
  { id: '5b',   label: '5B'   },
  { id: '10b',  label: '10B+' },
];
const SIGNALS = [
  { id: 'vol',   emoji: '🔥', label: 'VOLUME',   desc: 'נפח חריג פי 2.5+' },
  { id: 'break', emoji: '💥', label: 'BREAKOUT', desc: 'פריצה טכנית RSI+SMA' },
  { id: 'mom',   emoji: '🚀', label: 'MOMENTUM', desc: 'מובילי שבוע' },
];
const CAP_RANGES = {
  'all':  { min: 0,              max: Infinity         },
  '10m':  { min: 10_000_000,     max: 100_000_000      },
  '100m': { min: 100_000_000,    max: 1_000_000_000    },
  '1b':   { min: 1_000_000_000,  max: 5_000_000_000    },
  '5b':   { min: 5_000_000_000,  max: 10_000_000_000   },
  '10b':  { min: 10_000_000_000, max: Infinity         },
};
const CRYPTO_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=100&page=1' +
  '&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y';

// CoinGecko enrichment (market cap, name, logo, long timeframes) — top 250
const CG_MARKETS =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=250&page=1' +
  '&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y';
// Binance — real-time universe (all USDT pairs) for short timeframes
const BINANCE_24H = 'https://api.binance.com/api/v3/ticker/24hr';
// Tab id normalization across assets (crypto uses 24h/7d/30d; stocks 1d/1w/1m)
const STOCK_FROM_CRYPTO  = { '1h': '1d', '24h': '1d', '7d': '1w', '30d': '1m', '1y': '1y' };
const CRYPTO_FROM_STOCK  = { '1h': '1h', '1d': '24h', '1w': '7d', '1m': '30d', '1y': '1y' };

/* ── Stocks local cache (so a display always exists) ──────────── */
const STOCKS_CACHE_KEY = 'beepai_stocks_cache';
const STOCKS_REFRESH_MS = 60_000;  // auto-refresh cadence for stocks
function loadStocksCache(key) {
  try {
    const all = JSON.parse(localStorage.getItem(STOCKS_CACHE_KEY)) || {};
    return all[key] || null; // { quotes, ts }
  } catch { return null; }
}
function saveStocksCache(key, quotes) {
  try {
    const all = JSON.parse(localStorage.getItem(STOCKS_CACHE_KEY)) || {};
    all[key] = { quotes, ts: Date.now() };
    localStorage.setItem(STOCKS_CACHE_KEY, JSON.stringify(all));
  } catch { /* quota / disabled storage — ignore */ }
}

/* ── Data helpers ──────────────────────────────────────────── */
function getTabPct(coin, tabId) {
  switch (tabId) {
    case '1h':  return coin.price_change_percentage_1h_in_currency  ?? 0;
    case '7d':  return coin.price_change_percentage_7d_in_currency  ?? 0;
    case '30d': return coin.price_change_percentage_30d_in_currency ?? 0;
    case '1y':  return coin.price_change_percentage_1y_in_currency  ?? 0;
    default:    return coin.price_change_percentage_24h              ?? 0;
  }
}

/* ── Exact cryptobubbles.net color formula ─────────────────── */
function bubbleRGB(pct, colorN) {
  if (Math.abs(pct) < 0.001) return [127, 127, 127];
  const i = Math.floor(127 * (1 - colorN));
  const o = Math.floor(155 + 100 * colorN);
  return pct >= 0 ? [i, o, i] : [o, i, i];
}

/* ── Build bubbles — pure GAINERS: top movers by %, size by cap ──
   "15" = top 15 by % (gainers first); "all" = the whole set. */
function makeBubbles(items, W, H, showAll, favSet) {
  if (!items.length) return [];
  const ranked = [...items].sort((a, b) => (b.pct || 0) - (a.pct || 0)); // gainers first
  const pool   = showAll ? ranked.slice(0, 100) : ranked.slice(0, 15); // "all" caps at 100 (canvas-viewable)
  if (!pool.length) return [];

  const maxAbsPct  = Math.max(...pool.map(c => Math.abs(c.pct)), 0.1);
  const norm       = cap => Math.pow(Math.max(cap, 1), 0.8);
  const totalNorm  = pool.reduce((s, c) => s + norm(c.market_cap || 1), 0) || 1;
  // total bubble area ≈ 42% of canvas → room to pack without forced overlap
  const scaleFactor= (W * H * 0.42) / (totalNorm * Math.PI);

  return pool.map((c) => {
    const rawR   = Math.sqrt(norm(c.market_cap || 1) * scaleFactor);
    const r      = Math.max(13, Math.min(rawR, Math.min(W, H) * 0.30));
    const colorN = Math.max(0.2, Math.min(1.0, Math.abs(c.pct) / maxAbsPct));
    const x = r + Math.random() * (W - 2 * r);
    const y = r + Math.random() * (H - 2 * r);

    const assetType = c._type || (c.id && !c.symbol?.includes('-') ? 'crypto' : 'stocks');
    const favKey    = assetType === 'crypto' ? c.id : c.symbol;
    const isFav     = favSet ? favSet.has(favKey) : false;

    return {
      id: c.id, symbol: c.symbol, name: c.name,
      r, x, y,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      pct: c.pct, colorN,
      market_cap: c.market_cap,
      price: c.price, volume: c.volume,
      pct_1d: c.pct_1d, pct_1w: c.pct_1w, pct_1m: c.pct_1m, pct_1y: c.pct_1y,
      _type: assetType,
      isFav,
    };
  });
}

function symFontSize(diameter, symLen) {
  const frac = symLen < 5 ? 0.55 : symLen < 7 ? 0.45 : symLen < 9 ? 0.35 : 0.25;
  return Math.max(8, frac * diameter);
}
function pctFontSize(diameter) { return Math.max(7, 0.30 * diameter); }

/* ── Draw one bubble ───────────────────────────────────────── */
function drawBubble(ctx, b, logo, isHovered, isSelected, now) {
  const { x, y, r, pct, symbol, colorN = 0.5, isFav } = b;
  const [R, G, B] = bubbleRGB(pct, colorN);
  const diameter  = r * 2;
  const dpr       = window.devicePixelRatio || 1;
  const border    = Math.max(1.5, Math.round(2 * dpr));

  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0,   `rgba(${R},${G},${B},0.05)`);
  grad.addColorStop(0.8, `rgba(${R},${G},${B},0.10)`);
  grad.addColorStop(0.9, `rgba(${R},${G},${B},0.40)`);
  grad.addColorStop(1.0, `rgb(${R},${G},${B})`);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  if (isSelected) {
    const t = 0.5 * Math.sin(0.008 * now) + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r - border * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgb(${Math.floor(255*t)},${Math.floor(160*t)+95},255)`;
    ctx.lineWidth   = border * (t + 2);
    ctx.stroke();
  } else if (isHovered) {
    ctx.beginPath();
    ctx.arc(x, y, r - border * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth   = border;
    ctx.stroke();
  }

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur   = Math.max(1, 0.02 * diameter);

  if (r < 14) { ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; return; }

  const autoFit = (base, bold, text, maxW) => {
    ctx.font = `${bold ? 'bold ' : ''}${base}px Arial,sans-serif`;
    const w = ctx.measureText(text).width;
    return w <= maxW ? base : Math.max(8, base * (maxW / w));
  };
  const maxW   = r * 1.80;
  const absPct = Math.abs(pct);
  const pctStr = absPct >= 1000 ? absPct.toFixed(0)
               : absPct >= 100  ? absPct.toFixed(0)
               : absPct >= 10   ? absPct.toFixed(1)
               : absPct.toFixed(2);
  const pctTxt = `${pct >= 0 ? '+' : '-'}${pctStr}%`;
  const hasLogo = logo && r >= 22;

  if (hasLogo) {
    const ls = r * 0.32, ly = y - r * 0.22;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, ly, ls, 0, Math.PI * 2); ctx.clip();
    try { ctx.drawImage(logo, x - ls, ly - ls, ls * 2, ls * 2); } catch { /**/ }
    ctx.restore();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur  = Math.max(1, 0.02 * diameter);
    const s1 = autoFit(r * 0.28, true, symbol, maxW * 0.85);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s1}px Arial,sans-serif`;
    ctx.fillText(symbol, x, y + r * 0.22);
    const s2 = autoFit(r * 0.22, false, pctTxt, maxW * 0.85);
    ctx.font = `${s2}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(pctTxt, x, y + r * 0.52);
  } else {
    const s1 = autoFit(symFontSize(diameter, symbol.length), true, symbol, maxW);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s1}px Arial,sans-serif`;
    ctx.fillText(symbol, x, y + r * 0.10);
    const s2 = autoFit(pctFontSize(diameter), false, pctTxt, maxW);
    ctx.font = `${s2}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(pctTxt, x, y + r * 0.55);
  }

  // ⭐ favorites indicator
  if (isFav && r >= 18) {
    ctx.shadowBlur = 0;
    ctx.font = `${Math.max(9, r * 0.22)}px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText('⭐', x + r * 0.45, y - r * 0.92);
    ctx.textBaseline = 'middle';
  }

  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';
}

/* ── Component ────────────────────────────────────────────── */
export default function BubbleChart({ onManualSearch, onClose }) {
  const canvasRef  = useRef(null);
  const bubblesRef = useRef([]);
  const imgCache   = useRef({});
  const rafRef     = useRef(null);

  const cryptoCoinsRef = useRef([]);
  const stocksRef      = useRef([]);
  const favItemsRef    = useRef([]);
  const cgMapRef       = useRef(null);  // symbol → CoinGecko info (cap/name/logo/7d)
  const cgArrRef       = useRef([]);    // full CoinGecko array (for 30d/1y universe)

  const assetRef   = useRef('crypto');
  const tabRef     = useRef('1h');
  const capRef     = useRef('all');
  const showAllRef = useRef(false);
  const signalRef  = useRef(null);

  const [asset,     setAsset]     = useState('crypto');
  const [activeTab, setActiveTab] = useState('1h');
  const [capFilter, setCapFilter] = useState('all');
  const [showAll,   setShowAll]   = useState(false);
  const [signal,    setSignal]    = useState(null);
  const [selectedBubble, setSelectedBubble] = useState(null);
  const [capOpen,   setCapOpen]   = useState(false);
  const [timeOpen,  setTimeOpen]  = useState(false);

  const capDdRef      = useRef(null);
  const timeDdRef     = useRef(null);
  const hoveredIdRef  = useRef(null);
  const selectedIdRef = useRef(null);

  const [cryptoStatus, setCryptoStatus] = useState('idle');
  const [stocksStatus, setStocksStatus] = useState('idle');
  const [favStatus,    setFavStatus]    = useState('idle');
  const [cryptoRetryTrigger, setCryptoRetryTrigger] = useState(0);
  const [refreshing,   setRefreshing]   = useState(false); // background refresh in flight

  /* ── canvas sync ─────────────────────────────────────────── */
  const syncCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return { w: 0, h: 0 };
    const w = c.offsetWidth, h = c.offsetHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { w, h };
  }, []);

  /* ── rebuild bubbles ─────────────────────────────────────── */
  const rebuildBubbles = useCallback(() => {
    const { w, h } = syncCanvas();
    if (!w) return;

    // Build favorites set for star indicators
    const favs    = getFavorites();
    const favSet  = new Set([...favs.crypto, ...favs.stocks]);

    const makeItems = (raw) => makeBubbles(raw, w, h, showAllRef.current, favSet);

    if (assetRef.current === 'crypto') {
      const coins = cryptoCoinsRef.current;
      if (!coins.length) return;

      const capRange = CAP_RANGES[capRef.current] || CAP_RANGES['all'];
      let filtered = capRange.min > 0
        ? coins.filter(c => {
            const mc = c.market_cap || 0;
            return mc >= capRange.min && (capRange.max === Infinity || mc < capRange.max);
          })
        : coins;

      // Client-side signal filter for crypto
      const sig = signalRef.current;
      if (sig === 'vol') {
        filtered = filtered.filter(c => {
          const vr = (c.total_volume || 0) / (c.market_cap || 1);
          return vr > 0.08 && (c.price_change_percentage_24h || 0) > 3;
        });
      } else if (sig === 'break') {
        filtered = filtered.filter(c => {
          const p = c.price_change_percentage_24h || 0;
          return p > 2 && p < 15 && (c.price_change_percentage_7d_in_currency || 0) > 0;
        });
      } else if (sig === 'mom') {
        filtered = filtered.filter(c =>
          (c.price_change_percentage_7d_in_currency || 0) > 10 &&
          (c.price_change_percentage_24h || 0) > 0
        );
      }

      const pool = filtered.length > 0 ? filtered : coins;
      const items = pool.map(c => ({
        id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
        pct: c.pct ?? 0,   // already the selected-period % (Binance/CoinGecko)
        market_cap: c.market_cap || 1,
        price: c.current_price, volume: c.total_volume,
        _type: 'crypto',
      }));
      bubblesRef.current = makeItems(items);

    } else if (assetRef.current === 'stocks') {
      const stocks = stocksRef.current;
      if (!stocks.length) return;
      const items = stocks.map(s => ({
        id: s.symbol, symbol: s.symbol, name: s.name,
        pct: s.change_pct,
        market_cap: s.market_cap || 1,
        price: s.price, volume: s.volume,
        pct_1d: s.pct_1d ?? s.change_pct,
        pct_1w: s.pct_1w ?? null,
        pct_1m: s.pct_1m ?? null,
        pct_1y: s.pct_1y ?? null,
        _type: 'stocks',
      }));
      bubblesRef.current = makeItems(items);

    } else if (assetRef.current === 'favorites') {
      const favItems = favItemsRef.current;
      if (!favItems.length) return;
      const items = favItems.map(s => ({
        id: s.id || s.symbol,
        symbol: s.symbol, name: s.name,
        pct: s.change_pct || 0,
        market_cap: s.market_cap || 1,
        price: s.price, volume: s.volume,
        _type: s._type || 'stocks',
      }));
      bubblesRef.current = makeBubbles(items, w, h, true, favSet); // favorites: all
    }
  }, [syncCanvas]);

  /* ── fetch crypto — Binance (real-time, all USDT) + CoinGecko (cap/logo/long tf) ── */
  const fetchCrypto = useCallback(async (period) => {
    const cold = cryptoCoinsRef.current.length === 0;
    if (cold) setCryptoStatus('loading'); else setRefreshing(true);
    try {
      // CoinGecko map — once (market cap, name, logo, 7d for signal filters)
      if (!cgMapRef.current) {
        const cg = await (await fetch(CG_MARKETS, { signal: AbortSignal.timeout(10000) })).json();
        cgArrRef.current = Array.isArray(cg) ? cg : [];
        const m = {};
        for (const c of cgArrRef.current) { const s = c.symbol.toUpperCase(); if (!m[s]) m[s] = c; }
        cgMapRef.current = m;
      }
      const cgMap = cgMapRef.current;

      let items;
      if (period === '30d' || period === '1y') {
        // Long timeframes → CoinGecko (Binance ticker can't provide them)
        const f = period === '30d' ? 'price_change_percentage_30d_in_currency'
                                   : 'price_change_percentage_1y_in_currency';
        items = cgArrRef.current.map(c => ({
          id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image,
          current_price: c.current_price, market_cap: c.market_cap || 0, total_volume: c.total_volume || 0,
          price_change_percentage_24h: c.price_change_percentage_24h || 0,
          price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency || 0,
          pct: c[f] || 0,
        }));
      } else {
        // Short timeframes → Binance real-time universe (all USDT pairs)
        const bn = await (await fetch(BINANCE_24H, { signal: AbortSignal.timeout(12000) })).json();
        let usdt = (Array.isArray(bn) ? bn : []).filter(t =>
          t.symbol.endsWith('USDT') && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol));
        const mk = (sym, pct, price, vol) => {
          const cgi = cgMap[sym];
          return {
            id: cgi ? cgi.id : sym.toLowerCase(), symbol: sym, name: cgi ? cgi.name : sym,
            image: cgi ? cgi.image : null,
            current_price: price, market_cap: cgi ? cgi.market_cap : 0, total_volume: vol,
            price_change_percentage_24h: pct,
            price_change_percentage_7d_in_currency: cgi ? (cgi.price_change_percentage_7d_in_currency || 0) : 0,
            pct,
          };
        };
        if (period === '24h') {
          items = usdt.map(t => mk(t.symbol.slice(0, -4),
            parseFloat(t.priceChangePercent), parseFloat(t.lastPrice), parseFloat(t.quoteVolume || 0)));
        } else {
          // 1h / 7d → Binance rolling window for the top ~120 by volume (batched)
          usdt.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
          const top = usdt.slice(0, 120);
          const bySym = {}; top.forEach(t => { bySym[t.symbol] = t; });
          const ws = period === '7d' ? '7d' : '1h';
          const syms = top.map(t => t.symbol);
          const chunks = [];
          for (let i = 0; i < syms.length; i += 50) chunks.push(syms.slice(i, i + 50));
          const res = await Promise.all(chunks.map(ch =>
            fetch(`https://api.binance.com/api/v3/ticker?symbols=${encodeURIComponent(JSON.stringify(ch))}&windowSize=${ws}`,
              { signal: AbortSignal.timeout(12000) }).then(r => r.json()).catch(() => [])));
          items = res.flat()
            .filter(t => t && isFinite(parseFloat(t.priceChangePercent)))
            .map(t => {
              const base = bySym[t.symbol] || t;
              return mk(t.symbol.slice(0, -4), parseFloat(t.priceChangePercent),
                parseFloat(base.lastPrice || t.lastPrice), parseFloat(base.quoteVolume || 0));
            });
        }
      }

      cryptoCoinsRef.current = items;
      items.forEach(c => {
        if (!c.image || imgCache.current[c.id]) return;
        const img = new Image(); img.crossOrigin = 'anonymous'; img.src = c.image;
        img.onload = () => { imgCache.current[c.id] = img; }; img.onerror = () => {};
      });
      setCryptoStatus('ok'); setRefreshing(false);
      requestAnimationFrame(() => rebuildBubbles());
    } catch {
      setRefreshing(false);
      if (cryptoCoinsRef.current.length === 0) setCryptoStatus('error');
    }
  }, [rebuildBubbles]);

  /* ── initial crypto load + retry ── */
  useEffect(() => {
    if (cryptoCoinsRef.current.length > 0) return;
    fetchCrypto(tabRef.current);
  }, [fetchCrypto, cryptoRetryTrigger]);

  /* ── fetch stocks ─────────────────────────────────────────────
     Always keep a display: seed from local cache instantly, then
     refresh in the background (auto every 60s, or manual). The full
     spinner only shows on a true cold start with no cached data. */
  const fetchStocks = useCallback((cap, period = '1d', sig = null) => {
    const key = `${cap}:${period}:${sig || ''}`;

    if (stocksRef.current.length > 0) {
      setRefreshing(true);                       // we already show data → background refresh
    } else {
      const cached = loadStocksCache(key);
      if (cached?.quotes?.length) {              // instant display from cache
        stocksRef.current = cached.quotes;
        setStocksStatus('ok');
        setRefreshing(true);
        requestAnimationFrame(() => rebuildBubbles());
      } else {
        setStocksStatus('loading');              // genuine cold start
      }
    }

    const params = new URLSearchParams({ cap, period });
    if (sig) params.set('signal', sig);

    fetch(`/api/tv-screener?${params}`, { signal: AbortSignal.timeout(10_000) })
      .then(r => { if (!r.ok) throw r.status; return r.json(); })
      .then(data => {
        if (!data.quotes?.length) throw new Error('empty');
        stocksRef.current = data.quotes;
        saveStocksCache(key, data.quotes);
        setStocksStatus('ok');
        setRefreshing(false);
        requestAnimationFrame(() => rebuildBubbles());
      })
      .catch(() => {
        setRefreshing(false);
        // Keep whatever is on screen; only surface an error if we have nothing at all
        if (stocksRef.current.length === 0) setStocksStatus('error');
      });
  }, [rebuildBubbles]);

  /* ── fetch favorites ─────────────────────────────────────── */
  const fetchFavorites = useCallback(() => {
    const favs = getFavorites();
    const hasStocks = favs.stocks.length > 0;
    const hasCrypto = favs.crypto.length > 0;

    if (!hasStocks && !hasCrypto) {
      favItemsRef.current = [];
      setFavStatus('empty');
      return;
    }

    setFavStatus('loading');
    const promises = [];

    if (hasStocks) {
      promises.push(
        fetch(`/api/fav-quotes?symbols=${favs.stocks.join(',')}`)
          .then(r => r.json())
          .then(d => (d.quotes || []).map(s => ({ ...s, _type: 'stocks' })))
          .catch(() => [])
      );
    }
    if (hasCrypto) {
      promises.push(
        fetch(
          `https://api.coingecko.com/api/v3/coins/markets` +
          `?ids=${favs.crypto.join(',')}&vs_currency=usd&sparkline=false` +
          `&price_change_percentage=24h`
        )
          .then(r => r.json())
          .then(coins => coins.map(c => ({
            id: c.id,
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            price: c.current_price,
            change_pct: c.price_change_percentage_24h || 0,
            market_cap: c.market_cap || 1,
            volume: c.total_volume || 0,
            image: c.image,
            _type: 'crypto',
          })))
          .catch(() => [])
      );
    }

    Promise.all(promises)
      .then(results => {
        const all = results.flat();
        // Load logos for crypto favorites
        all.forEach(c => {
          if (c._type === 'crypto' && c.image && !imgCache.current[c.id]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = c.image;
            img.onload = () => { imgCache.current[c.id] = img; };
          }
        });
        favItemsRef.current = all;
        setFavStatus(all.length ? 'ok' : 'empty');
        if (all.length) requestAnimationFrame(() => rebuildBubbles());
      })
      .catch(() => setFavStatus('error'));
  }, [rebuildBubbles]);

  /* ── auto-retry on error ─────────────────────────────────── */
  useEffect(() => {
    if (cryptoStatus !== 'error') return;
    const t = setTimeout(() => {
      cryptoCoinsRef.current = [];
      setCryptoStatus('loading');
      setCryptoRetryTrigger(n => n + 1);
    }, 4000);
    return () => clearTimeout(t);
  }, [cryptoStatus]);

  useEffect(() => {
    if (stocksStatus !== 'error') return;
    const t = setTimeout(() => {
      fetchStocks(capRef.current, tabRef.current, signalRef.current);
    }, 4000);
    return () => clearTimeout(t);
  }, [stocksStatus, fetchStocks]);

  useEffect(() => {
    if (favStatus !== 'error') return;
    const t = setTimeout(() => fetchFavorites(), 4000);
    return () => clearTimeout(t);
  }, [favStatus, fetchFavorites]);

  /* ── auto-refresh stocks while the stocks tab is open ────────── */
  useEffect(() => {
    if (asset !== 'stocks') return;
    const iv = setInterval(() => {
      fetchStocks(capRef.current, tabRef.current, signalRef.current);
    }, STOCKS_REFRESH_MS);
    return () => clearInterval(iv);
  }, [asset, fetchStocks]);

  /* ── auto-refresh crypto while the crypto tab is open (real-time) ── */
  useEffect(() => {
    if (asset !== 'crypto') return;
    const iv = setInterval(() => {
      fetchCrypto(tabRef.current);
    }, STOCKS_REFRESH_MS);
    return () => clearInterval(iv);
  }, [asset, fetchCrypto]);

  /* ── manual refresh (current asset) ──────────────────────────── */
  const handleRefresh = useCallback(() => {
    if (assetRef.current === 'crypto') {
      fetchCrypto(tabRef.current);
    } else if (assetRef.current === 'stocks') {
      fetchStocks(capRef.current, tabRef.current, signalRef.current);
    } else {
      fetchFavorites();
    }
  }, [fetchCrypto, fetchStocks, fetchFavorites]);

  /* ── kick bubbles ─────────────────────────────────────────── */
  const kickBubbles = useCallback(() => {
    bubblesRef.current.forEach(b => {
      b.vx += (Math.random() - 0.5) * 1.2;
      b.vy += (Math.random() - 0.5) * 1.2;
    });
  }, []);

  /* ── signal toggle ───────────────────────────────────────── */
  const handleSignal = useCallback((id) => {
    const next = signalRef.current === id ? null : id;
    signalRef.current = next;
    setSignal(next);
    if (assetRef.current === 'crypto') {
      rebuildBubbles();
      kickBubbles();
    } else if (assetRef.current === 'stocks') {
      fetchStocks(capRef.current, tabRef.current, next); // keep current display while refreshing
    }
  }, [rebuildBubbles, kickBubbles, fetchStocks]);

  /* ── asset toggle ─────────────────────────────────────────── */
  const handleAsset = useCallback((a) => {
    assetRef.current = a;
    setAsset(a);
    signalRef.current = null;
    setSignal(null);
    if (a === 'favorites') {
      fetchFavorites();
    } else if (a === 'stocks') {
      // normalize tab to a valid stock timeframe (stocks have no real 1H)
      const st = STOCK_FROM_CRYPTO[tabRef.current] || tabRef.current;
      if (st !== tabRef.current) { tabRef.current = st; setActiveTab(st); }
      fetchStocks(capRef.current, tabRef.current, null);
    } else { // crypto
      const ct = CRYPTO_FROM_STOCK[tabRef.current] || tabRef.current;
      if (ct !== tabRef.current) { tabRef.current = ct; setActiveTab(ct); }
      fetchCrypto(tabRef.current);
    }
  }, [fetchStocks, fetchFavorites, fetchCrypto]);

  /* ── tab ──────────────────────────────────────────────────── */
  const handleTab = useCallback((id) => {
    tabRef.current = id;
    setActiveTab(id);
    if (assetRef.current === 'crypto') {
      fetchCrypto(id);   // refetch real-time data for the selected timeframe
    } else if (assetRef.current === 'stocks') {
      fetchStocks(capRef.current, id, signalRef.current); // keep current display while refreshing
    }
  }, [fetchCrypto, fetchStocks]);

  /* ── cap filter ───────────────────────────────────────────── */
  const handleCap = useCallback((id) => {
    capRef.current = id;
    setCapFilter(id);
    if (assetRef.current === 'stocks') {
      fetchStocks(id, tabRef.current, signalRef.current);
    } else {
      rebuildBubbles();
      kickBubbles();
    }
  }, [fetchStocks, rebuildBubbles, kickBubbles]);

  /* ── count toggle ─────────────────────────────────────────── */
  const handleToggle = useCallback(() => {
    const next = !showAllRef.current;
    showAllRef.current = next;
    setShowAll(next);
    rebuildBubbles();
    kickBubbles();
  }, [rebuildBubbles, kickBubbles]);

  /* ── hover ────────────────────────────────────────────────── */
  const handleCanvasMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    let hit = null;
    for (const b of bubblesRef.current) {
      const dx = mx - b.x, dy = my - b.y;
      if (dx*dx + dy*dy <= (b.r+4)*(b.r+4)) { hit = b.id; break; }
    }
    hoveredIdRef.current = hit;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }, []);

  /* ── click ────────────────────────────────────────────────── */
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    for (const b of bubblesRef.current) {
      const dx = mx - b.x, dy = my - b.y;
      if (dx*dx + dy*dy <= (b.r+4)*(b.r+4)) {
        selectedIdRef.current = b.id;
        setSelectedBubble({ ...b });
        return;
      }
    }
    selectedIdRef.current = null;
    setSelectedBubble(null);
  }, []);

  /* ── animation loop ───────────────────────────────────────── */
  useEffect(() => {
    const curStatus = asset === 'crypto' ? cryptoStatus
                    : asset === 'stocks' ? stocksStatus
                    : favStatus;
    if (curStatus !== 'ok') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTime = performance.now();
    const animate = () => {
      const now   = performance.now();
      const dt    = Math.min((now - lastTime) / 1000, 0.1);
      lastTime    = now;

      const { w: W, h: H } = syncCanvas();
      if (!W || !H) { rafRef.current = requestAnimationFrame(animate); return; }
      if (bubblesRef.current.length === 0) rebuildBubbles();

      const ctx = canvas.getContext('2d');
      const bs  = bubblesRef.current;
      if (!bs.length) { rafRef.current = requestAnimationFrame(animate); return; }

      ctx.clearRect(0, 0, W, H);

      const driftMag = 0.0006 * Math.min(W, H) * dt;  // gentle float
      const decay    = Math.pow(0.5, dt);
      const maxSpd   = 1.6;

      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        b.vx += (Math.random() * 2 - 1) * driftMag;
        b.vy += (Math.random() * 2 - 1) * driftMag;
        b.vx *= decay; b.vy *= decay;
        const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
        if (spd > maxSpd) { b.vx = (b.vx/spd)*maxSpd; b.vy = (b.vy/spd)*maxSpd; }
        b.x += b.vx; b.y += b.vy;
        // collision: hard positional separation so bubbles never overlap
        for (let j = i + 1; j < bs.length; j++) {
          const b2   = bs[j];
          const dx   = b.x - b2.x, dy = b.y - b2.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 0.01;
          const sumR = b.r + b2.r;
          if (dist < sumR) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = sumR - dist;
            const total   = b.r + b2.r;
            const pushA = overlap * (b2.r / total);  // smaller bubble yields more
            const pushB = overlap * (b.r  / total);
            b.x  += nx * pushA; b.y  += ny * pushA;
            b2.x -= nx * pushB; b2.y -= ny * pushB;
            b.vx  += nx * 0.02; b.vy  += ny * 0.02;
            b2.vx -= nx * 0.02; b2.vy -= ny * 0.02;
          }
        }
      }

      // final wall clamp (after positional separation)
      for (const b of bs) {
        if (b.x < b.r)     { b.x = b.r;     if (b.vx < 0) b.vx *= -0.6; }
        if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 0) b.vx *= -0.6; }
        if (b.y < b.r)     { b.y = b.r;     if (b.vy < 0) b.vy *= -0.6; }
        if (b.y > H - b.r) { b.y = H - b.r; if (b.vy > 0) b.vy *= -0.6; }
      }

      const selId = selectedIdRef.current, hovId = hoveredIdRef.current;
      for (const b of bs) {
        drawBubble(ctx, b,
          imgCache.current[b.id] || null,
          b.id === hovId && b.id !== selId,
          b.id === selId,
          now
        );
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [asset, cryptoStatus, stocksStatus, favStatus, syncCanvas, rebuildBubbles]);

  /* ── close dropdowns on outside click ───────────────────── */
  useEffect(() => {
    const h = (e) => {
      if (capDdRef.current  && !capDdRef.current.contains(e.target))  setCapOpen(false);
      if (timeDdRef.current && !timeDdRef.current.contains(e.target)) setTimeOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── when favorite changes, refresh star indicators ─────── */
  const handleFavChanged = useCallback(() => {
    if (assetRef.current === 'favorites') {
      fetchFavorites();
    } else {
      rebuildBubbles(); // refresh star indicators
    }
  }, [fetchFavorites, rebuildBubbles]);

  const curStatus    = asset === 'crypto' ? cryptoStatus
                     : asset === 'stocks' ? stocksStatus
                     : favStatus;
  const showCanvas   = curStatus === 'ok';
  const currentTabs  = asset === 'crypto' ? CRYPTO_TABS : STOCK_TABS;
  const activeTabLbl = currentTabs.find(t => t.id === activeTab)?.label || '1H';
  const capLabel     = CAP_OPTS.find(c => c.id === capFilter)?.label || 'הכל';

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="bc-wrap">

      {/* ── Row 1: main controls ── */}
      <div className="bc-header">
        <div className="bc-controls-left">

          {/* Count toggle */}
          <div className="bc-mode-toggle">
            <button className={`bc-mode-btn${!showAll ? ' bc-mode-btn--on' : ''}`}
              onClick={() => showAll && handleToggle()}>15</button>
            <button className={`bc-mode-btn${showAll ? ' bc-mode-btn--on' : ''}`}
              onClick={() => !showAll && handleToggle()}>הכל</button>
          </div>

          {/* Time dropdown — hidden for favorites */}
          {asset !== 'favorites' && (
            <div className="bc-dd-wrap" ref={timeDdRef}>
              <button className="bc-dd-btn"
                onClick={() => { setTimeOpen(v => !v); setCapOpen(false); }}>
                {activeTabLbl} <span className="bc-dd-arrow">{timeOpen ? '▴' : '▾'}</span>
              </button>
              {timeOpen && (
                <div className="bc-dd-menu">
                  {currentTabs.map(t => (
                    <button key={t.id}
                      className={`bc-dd-item${activeTab === t.id ? ' bc-dd-item--on' : ''}`}
                      onClick={() => { handleTab(t.id); setTimeOpen(false); }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Market Cap dropdown */}
          <div className="bc-dd-wrap" ref={capDdRef}>
            <button className="bc-dd-btn"
              onClick={() => { setCapOpen(v => !v); setTimeOpen(false); }}>
              MARKET CAP{capFilter !== 'all' ? `: ${capLabel}` : ''}
              <span className="bc-dd-arrow">{capOpen ? '▴' : '▾'}</span>
            </button>
            {capOpen && (
              <div className="bc-dd-menu">
                {CAP_OPTS.map(c => (
                  <button key={c.id}
                    className={`bc-dd-item${capFilter === c.id ? ' bc-dd-item--on' : ''}`}
                    onClick={() => { handleCap(c.id); setCapOpen(false); }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Asset toggle + close */}
        <div className="bc-controls-right">
          <div className="bc-asset-toggle">
            <button className={`bc-asset-btn${asset === 'crypto'    ? ' bc-asset-btn--on' : ''}`}
              onClick={() => asset !== 'crypto'    && handleAsset('crypto')}>CRYPTO</button>
            <button className={`bc-asset-btn${asset === 'stocks'    ? ' bc-asset-btn--on' : ''}`}
              onClick={() => asset !== 'stocks'    && handleAsset('stocks')}>STOCKS</button>
            <button className={`bc-asset-btn${asset === 'favorites' ? ' bc-asset-btn--on' : ''}`}
              onClick={() => asset !== 'favorites' && handleAsset('favorites')}>⭐</button>
          </div>
          <button className="bc-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Row 2: signal buttons (crypto + stocks only) ── */}
      {asset !== 'favorites' && (
        <div className="bc-signal-row">
          {/* Default: GAINERS — no filter, just top movers by time + market cap */}
          <button
            className={`bc-sig-btn bc-sig-btn--gainers${signal === null ? ' bc-sig-btn--on' : ''}`}
            title="המובילים לפי זמן ומרקט-קאפ — ללא מסננים"
            onClick={() => { if (signal !== null) handleSignal(signal); }}>
            📈 GAINERS
          </button>
          {SIGNALS.map(s => (
            <button key={s.id}
              className={`bc-sig-btn${signal === s.id ? ' bc-sig-btn--on' : ''}`}
              title={s.desc}
              onClick={() => handleSignal(s.id)}>
              {s.emoji} {s.label}
            </button>
          ))}
          {signal && (
            <span className="bc-sig-active-label">
              {SIGNALS.find(s => s.id === signal)?.desc}
            </span>
          )}
          {/* Refresh — pinned to the left of the filter row */}
          <button
            className={`bc-refresh-btn bc-refresh-btn--inline${refreshing ? ' bc-refresh-btn--spinning' : ''}`}
            onClick={handleRefresh}
            title="רענן נתונים"
            aria-label="רענן נתונים">
            <span className="bc-refresh-ico">⟳</span>
            {refreshing ? ' מתעדכן' : ' רענן'}
          </button>
        </div>
      )}

      {/* ── Canvas area ── */}
      <div style={{ position: 'relative' }}>

        {curStatus === 'idle' && (
          <div className="bc-state"><span>בחר סוג נכס</span></div>
        )}
        {(curStatus === 'loading' || curStatus === 'error') && (
          <div className="bc-state">
            <div className="bc-spinner" />
            <span className="bc-loading-text">
              טוען<span className="bc-dots"><span>.</span><span>.</span><span>.</span></span>
            </span>
            <button className="bc-speedup-btn" onClick={handleRefresh}>
              ⟳ לחץ לזירוז טעינה
            </button>
          </div>
        )}
        {curStatus === 'empty' && (
          <div className="bc-state">
            <span style={{ fontSize: 28 }}>⭐</span>
            <span>אין מועדפים עדיין</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '0 24px' }}>
              לחץ ⭐ על כל בועה כדי להוסיף למעקב
            </span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="bc-canvas"
          style={{ display: showCanvas ? 'block' : 'none' }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onMouseLeave={() => { hoveredIdRef.current = null; }}
        />

        {selectedBubble && (
          <BubbleDetail
            bubble={selectedBubble}
            asset={asset}
            coinsData={cryptoCoinsRef.current}
            onClose={() => { setSelectedBubble(null); selectedIdRef.current = null; }}
            onFavChanged={handleFavChanged}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="bc-footer">
        <span className="bc-live-dot">● LIVE</span>
        <span className="bc-credit">
          {asset === 'crypto'    ? 'Binance · זמן אמת'
           : asset === 'stocks'  ? 'TradingView · זמן אמת'
           : 'מועדפים אישיים'}
        </span>
        <button className="bc-manual-btn" onClick={onManualSearch}>
          🔍 סריקה ידנית
        </button>
      </div>
    </div>
  );
}
