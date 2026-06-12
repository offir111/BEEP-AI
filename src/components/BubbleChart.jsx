/**
 * BubbleChart.jsx — cryptobubbles.net pixel-accurate clone
 * • Color  = exact RGB formula: n=clamp(|pct|/maxPct,0.2,1), i=127*(1-n), o=155+100*n
 * • Fill   = radial gradient: transparent center → opaque ring (no glow)
 * • Size   = cap^0.8 scaled so total bubble area = 60% of canvas
 * • Physics = every-frame drift, hard wall -0.7v, size-weighted collision, no gravity
 * • Hover  = white ring | Selected = pulsating blue→white ring (~785ms)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import './BubbleChart.css';
import BubbleDetail from './BubbleDetail';

/* ── Constants ─────────────────────────────────────────────── */
// Crypto tabs (map to CoinGecko period IDs)
const CRYPTO_TABS = [
  { id: '1h',  label: '1H' },
  { id: '24h', label: '1D' },
  { id: '7d',  label: '1W' },
  { id: '30d', label: '1M' },
];
// Stock tabs (same display, map to stock-detail period IDs)
const STOCK_TABS = [
  { id: '1h', label: '1H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
];
const CAP_OPTS = [
  { id: 'all',  label: 'הכל'  },
  { id: '10m',  label: '10M'  },
  { id: '100m', label: '100M' },
  { id: '1b',   label: '1B'   },
  { id: '5b',   label: '5B'   },
  { id: '10b',  label: '10B+' },
];
const CRYPTO_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=50&page=1' +
  '&sparkline=false&price_change_percentage=1h,24h,7d,30d';

/* ── Data helpers ──────────────────────────────────────────── */
function getTabPct(coin, tabId) {
  switch (tabId) {
    case '1h':  return coin.price_change_percentage_1h_in_currency  ?? 0;
    case '7d':  return coin.price_change_percentage_7d_in_currency  ?? 0;
    case '30d': return coin.price_change_percentage_30d_in_currency ?? 0;
    default:    return coin.price_change_percentage_24h              ?? 0;
  }
}

/* ── Exact cryptobubbles.net color formula ─────────────────── */
function bubbleRGB(pct, colorN) {
  // colorN = clamp(|pct|/maxPct, 0.2, 1.0) — pre-computed in makeBubbles
  if (Math.abs(pct) < 0.001) return [127, 127, 127];
  const i = Math.floor(127 * (1 - colorN));    // dark:   127→0
  const o = Math.floor(155 + 100 * colorN);    // bright: 155→255
  return pct >= 0
    ? [i, o, i]   // green: rgb(dark, bright, dark)
    : [o, i, i];  // red:   rgb(bright, dark, dark)
}

/* ── Build bubbles — cap^0.8 so total area = 60% of canvas ── */
function makeBubbles(items, W, H, showAll) {
  const pool = showAll
    ? items
    : [...items].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 15);
  if (!pool.length) return [];

  const count      = pool.length;
  const maxAbsPct  = Math.max(...pool.map(c => Math.abs(c.pct)), 0.1);

  // Size: total bubble area = 60% of canvas  (power 0.8, exact original)
  const norm       = cap => Math.pow(Math.max(cap, 1), 0.8);
  const totalNorm  = pool.reduce((s, c) => s + norm(c.market_cap || 1), 0);
  const scaleFactor= (W * H * 0.60) / (totalNorm * Math.PI);

  return pool.map((c) => {
    const rawR   = Math.sqrt(norm(c.market_cap || 1) * scaleFactor);
    const r      = Math.max(14, Math.min(rawR, Math.min(W, H) * 0.38));
    const colorN = Math.max(0.2, Math.min(1.0, Math.abs(c.pct) / maxAbsPct));

    // Exact original: fully random start positions across entire canvas
    const x = r + Math.random() * (W - 2 * r);
    const y = r + Math.random() * (H - 2 * r);

    return {
      id: c.id, symbol: c.symbol, name: c.name,
      r,
      x, y,
      vx: (Math.random() - 0.5) * 0.08,  // nearly still at start
      vy: (Math.random() - 0.5) * 0.08,
      pct:        c.pct,
      colorN,
      market_cap: c.market_cap,
      price:      c.price,
      volume:     c.volume,
    };
  });
}

/* Font size scaling matching cryptobubbles (fraction of diameter) */
function symFontSize(diameter, symLen) {
  const frac = symLen < 5 ? 0.55 : symLen < 7 ? 0.45 : symLen < 9 ? 0.35 : 0.25;
  return Math.max(8, frac * diameter);
}
function pctFontSize(diameter) {
  return Math.max(7, 0.30 * diameter);
}

/* ── Draw one bubble — exact cryptobubbles.net rendering ─── */
function drawBubble(ctx, b, logo, isHovered, isSelected, now) {
  const { x, y, r, pct, symbol, colorN = 0.5 } = b;
  const [R, G, B] = bubbleRGB(pct, colorN);
  const diameter  = r * 2;
  const dpr       = window.devicePixelRatio || 1;
  const border    = Math.max(1.5, Math.round(2 * dpr));

  /* ── 1. Radial gradient fill (transparent center → opaque ring) ── */
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0,   `rgba(${R},${G},${B},0.05)`);
  grad.addColorStop(0.8, `rgba(${R},${G},${B},0.10)`);
  grad.addColorStop(0.9, `rgba(${R},${G},${B},0.40)`);
  grad.addColorStop(1.0, `rgb(${R},${G},${B})`);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  /* ── 2. Border: selected (pulsating) | hovered (white) ── */
  if (isSelected) {
    const t  = 0.5 * Math.sin(0.008 * now) + 0.5;          // 0→1, ~785ms
    const rr = Math.floor(255 * t);
    const gg = Math.floor(160 * t) + 95;
    ctx.beginPath();
    ctx.arc(x, y, r - border * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgb(${rr},${gg},255)`;
    ctx.lineWidth   = border * (t + 2);
    ctx.stroke();
  } else if (isHovered) {
    ctx.beginPath();
    ctx.arc(x, y, r - border * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth   = border;
    ctx.stroke();
  }

  /* ── 3. Text ── */
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const shadowBlur = Math.max(1, 0.02 * diameter);
  ctx.shadowColor  = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur   = shadowBlur;

  // Skip all text for tiny bubbles — nothing fits
  if (r < 14) {
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
    return;
  }

  /* ── Helper: measure and auto-shrink to fit maxWidth ── */
  const autoFitFont = (baseSize, bold, text, maxW) => {
    const f = `${bold ? 'bold ' : ''}${baseSize}px Arial,sans-serif`;
    ctx.font = f;
    const w = ctx.measureText(text).width;
    if (w <= maxW) return baseSize;
    return Math.max(8, baseSize * (maxW / w));
  };

  const maxTextW = r * 1.80;   // 90% of diameter — guaranteed to stay inside bubble
  const pctText  = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

  const hasLogo = logo && r >= 22;
  if (hasLogo) {
    /* Logo upper half */
    const ls = r * 0.32, ly = y - r * 0.22;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, ly, ls, 0, Math.PI * 2); ctx.clip();
    try { ctx.drawImage(logo, x - ls, ly - ls, ls * 2, ls * 2); } catch { /**/ }
    ctx.restore();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur  = shadowBlur;

    /* Symbol — auto-fit */
    const ls1 = autoFitFont(r * 0.28, true, symbol, maxTextW * 0.85);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${ls1}px Arial,sans-serif`;
    ctx.fillText(symbol, x, y + r * 0.22);

    /* % — auto-fit */
    const ls2 = autoFitFont(r * 0.22, false, pctText, maxTextW * 0.85);
    ctx.font = `${ls2}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(pctText, x, y + r * 0.52);

  } else {
    /* No logo — symbol + % stacked, both auto-fit */
    const rawSym = symFontSize(diameter, symbol.length);
    const s1 = autoFitFont(rawSym, true, symbol, maxTextW);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s1}px Arial,sans-serif`;
    ctx.fillText(symbol, x, y + r * 0.10);

    const rawPct = pctFontSize(diameter);
    const s2 = autoFitFont(rawPct, false, pctText, maxTextW);
    ctx.font = `${s2}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(pctText, x, y + r * 0.55);
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

  const assetRef   = useRef('crypto');
  const tabRef     = useRef('1h');
  const capRef     = useRef('all');
  const showAllRef = useRef(false);

  const [asset,     setAsset]     = useState('crypto');
  const [activeTab, setActiveTab] = useState('1h');
  const [capFilter, setCapFilter] = useState('all');
  const [showAll,   setShowAll]   = useState(false);
  const [selectedBubble, setSelectedBubble] = useState(null);
  const [capOpen,   setCapOpen]   = useState(false);
  const [timeOpen,  setTimeOpen]  = useState(false);
  const capDdRef      = useRef(null);
  const timeDdRef     = useRef(null);
  const hoveredIdRef  = useRef(null);   // id of bubble under pointer
  const selectedIdRef = useRef(null);   // id of bubble clicked (for canvas draw)

  const [cryptoStatus, setCryptoStatus] = useState('idle');
  const [stocksStatus, setStocksStatus] = useState('idle');

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
    if (assetRef.current === 'crypto') {
      const coins = cryptoCoinsRef.current;
      if (!coins.length) return;
      const items = coins.map(c => ({
        id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
        pct: getTabPct(c, tabRef.current),
        market_cap: c.market_cap || 1,
        price:  c.current_price,
        volume: c.total_volume,
      }));
      bubblesRef.current = makeBubbles(items, w, h, showAllRef.current);
    } else {
      const stocks = stocksRef.current;
      if (!stocks.length) return;
      const items = stocks.map(s => ({
        id: s.symbol, symbol: s.symbol, name: s.name,
        pct: s.change_pct,
        market_cap: s.market_cap || 1,
        price:  s.price,
        volume: s.volume,
      }));
      bubblesRef.current = makeBubbles(items, w, h, showAllRef.current);
    }
  }, [syncCanvas]);

  /* ── fetch crypto ─────────────────────────────────────────── */
  useEffect(() => {
    if (cryptoCoinsRef.current.length) return;
    setCryptoStatus('loading');
    fetch(CRYPTO_URL)
      .then(r => { if (!r.ok) throw r.status; return r.json(); })
      .then(data => {
        cryptoCoinsRef.current = data;
        data.forEach(c => {
          if (!c.image || imgCache.current[c.id]) return;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = c.image;
          img.onload  = () => { imgCache.current[c.id] = img; };
          img.onerror = () => {};
        });
        setCryptoStatus('ok');
        requestAnimationFrame(() => rebuildBubbles());
      })
      .catch(() => setCryptoStatus('error'));
  }, [rebuildBubbles]);

  /* ── fetch stocks ─────────────────────────────────────────── */
  const fetchStocks = useCallback((cap) => {
    setStocksStatus('loading');
    fetch(`/api/tv-screener?cap=${cap}`)
      .then(r => { if (!r.ok) throw r.status; return r.json(); })
      .then(data => {
        if (!data.quotes?.length) throw new Error('empty');
        stocksRef.current = data.quotes;
        setStocksStatus('ok');
        requestAnimationFrame(() => rebuildBubbles());
      })
      .catch(() => setStocksStatus('error'));
  }, [rebuildBubbles]);

  /* ── kick: physical reaction when params change ─────────── */
  /* MUST be defined before any handler that uses it           */
  const kickBubbles = useCallback(() => {
    bubblesRef.current.forEach(b => {
      b.vx += (Math.random() - 0.5) * 1.2;
      b.vy += (Math.random() - 0.5) * 1.2;
    });
  }, []);

  /* ── asset toggle ─────────────────────────────────────────── */
  const handleAsset = useCallback((a) => {
    assetRef.current = a;
    setAsset(a);
    if (a === 'stocks' && !stocksRef.current.length) {
      fetchStocks(capRef.current);
    } else {
      requestAnimationFrame(() => { rebuildBubbles(); kickBubbles(); });
    }
  }, [fetchStocks, rebuildBubbles, kickBubbles]);

  /* ── tab (crypto) ─────────────────────────────────────────── */
  const handleTab = useCallback((id) => {
    tabRef.current = id;
    setActiveTab(id);
    const coins = cryptoCoinsRef.current;
    const updated = bubblesRef.current.map(b => {
      const coin = coins.find(c => c.id === b.id);
      return { ...b, pct: coin ? getTabPct(coin, id) : b.pct };
    });
    const maxAbsPct = Math.max(...updated.map(b => Math.abs(b.pct)), 0.1);
    bubblesRef.current = updated.map(b => ({
      ...b,
      colorN: Math.max(0.2, Math.min(1.0, Math.abs(b.pct) / maxAbsPct)),
    }));
    kickBubbles();
  }, [kickBubbles]);

  /* ── cap filter (stocks) ──────────────────────────────────── */
  const handleCap = useCallback((id) => {
    capRef.current = id;
    setCapFilter(id);
    fetchStocks(id);
  }, [fetchStocks]);

  /* ── count toggle ─────────────────────────────────────────── */
  const handleToggle = useCallback(() => {
    const next = !showAllRef.current;
    showAllRef.current = next;
    setShowAll(next);
    rebuildBubbles();
    kickBubbles();
  }, [rebuildBubbles, kickBubbles]);

  /* ── hover (for white ring effect) ───────────────────────── */
  const handleCanvasMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx     = (e.clientX - rect.left) * scaleX;
    const my     = (e.clientY - rect.top)  * scaleY;
    let hit = null;
    for (const b of bubblesRef.current) {
      const dx = mx - b.x, dy = my - b.y;
      if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) { hit = b.id; break; }
    }
    hoveredIdRef.current = hit;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }, []);

  /* ── canvas click → open detail panel ───────────────────── */
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx     = (e.clientX - rect.left) * scaleX;
    const my     = (e.clientY - rect.top)  * scaleY;
    for (const b of bubblesRef.current) {
      const dx = mx - b.x, dy = my - b.y;
      if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) {
        selectedIdRef.current = b.id;
        setSelectedBubble({ ...b });
        return;
      }
    }
    // Click on empty → deselect
    selectedIdRef.current = null;
    setSelectedBubble(null);
  }, []);

  /* ── animation loop ───────────────────────────────────────── */
  useEffect(() => {
    const curStatus = asset === 'crypto' ? cryptoStatus : stocksStatus;
    if (curStatus !== 'ok') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTime = performance.now();

    const animate = () => {
      const now      = performance.now();
      const rawDt    = (now - lastTime) / 1000;   // seconds
      const dt       = Math.min(rawDt, 0.1);       // cap at 100ms
      lastTime       = now;

      const { w: W, h: H } = syncCanvas();
      if (!W || !H) { rafRef.current = requestAnimationFrame(animate); return; }

      /* Auto-rebuild if canvas is now visible but bubbles haven't been created yet
         (happens when RAF fired before React updated display:none → display:block) */
      if (bubblesRef.current.length === 0) {
        rebuildBubbles();
      }

      const ctx = canvas.getContext('2d');
      const bs  = bubblesRef.current;
      if (!bs.length) { rafRef.current = requestAnimationFrame(animate); return; }

      /* Clear (CSS background of .bc-canvas provides dark bg) */
      ctx.clearRect(0, 0, W, H);

      /* ── Physics ── */
      // Drift: ±0.001×min(W,H) per SECOND (×dt = frame-rate independent)
      const driftMag = 0.001 * Math.min(W, H) * dt;
      const decay    = Math.pow(0.5, dt);   // half-life = 1s

      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];

        /* 1. Every-frame drift × dt — small, organic, continuous */
        b.vx += (Math.random() * 2 - 1) * driftMag;
        b.vy += (Math.random() * 2 - 1) * driftMag;

        /* 2. Exponential damping — half-life = 1s (exact original) */
        b.vx *= decay;
        b.vy *= decay;

        /* 3. Speed cap — prevent runaway velocity */
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (spd > 2.5) { b.vx = (b.vx / spd) * 2.5; b.vy = (b.vy / spd) * 2.5; }

        /* 4. Integrate */
        b.x += b.vx;
        b.y += b.vy;

        /* 5. Hard wall bounce — 70% restitution (exact original) */
        if (b.x < b.r)     { b.x = b.r;     b.vx *= -0.7; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.7; }
        if (b.y < b.r)     { b.y = b.r;     b.vy *= -0.7; }
        if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -0.7; }

        /* 6. Bubble–bubble collision (size-weighted, exact original × dt) */
        for (let j = i + 1; j < bs.length; j++) {
          const b2  = bs[j];
          const dx  = b.x - b2.x;
          const dy  = b.y - b2.y;
          const dist= Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const sumR= b.r + b2.r;
          if (dist < sumR) {
            // Scale by dt so collision impulse is frame-rate independent
            const scale = 6 * dt / dist;
            const nx    = dx * scale;
            const ny    = dy * scale;
            const cA    = 1 - b.r  / sumR;   // fraction for b  (smaller → bigger push)
            const cB    = b2.r / sumR - 1;   // fraction for b2 (pushes opposite)
            b.vx  += nx * cA;
            b.vy  += ny * cA;
            b2.vx += nx * cB;
            b2.vy += ny * cB;
          }
        }
      }

      /* ── Draw ── */
      const selId = selectedIdRef.current;
      const hovId = hoveredIdRef.current;
      const nowMs = now;   // for pulsating animation
      for (const b of bs) {
        drawBubble(
          ctx, b,
          imgCache.current[b.id] || null,
          b.id === hovId && b.id !== selId,
          b.id === selId,
          nowMs
        );
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [asset, cryptoStatus, stocksStatus, syncCanvas, rebuildBubbles]);

  const curStatus  = asset === 'crypto' ? cryptoStatus : stocksStatus;
  const showCanvas = curStatus === 'ok';

  /* ── Close dropdowns on outside click ───────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (capDdRef.current  && !capDdRef.current.contains(e.target))  setCapOpen(false);
      if (timeDdRef.current && !timeDdRef.current.contains(e.target)) setTimeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentTabs = asset === 'crypto' ? CRYPTO_TABS : STOCK_TABS;
  const activeTabLabel = currentTabs.find(t => t.id === activeTab)?.label || '1H';
  const capLabel = CAP_OPTS.find(c => c.id === capFilter)?.label || 'הכל';

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="bc-wrap">

      {/* ── Single control row ── */}
      <div className="bc-header">

        {/* LEFT: filters */}
        <div className="bc-controls-left">

          {/* 1. Count toggle */}
          <div className="bc-mode-toggle">
            <button
              className={`bc-mode-btn${!showAll ? ' bc-mode-btn--on' : ''}`}
              onClick={() => showAll && handleToggle()}>
              15
            </button>
            <button
              className={`bc-mode-btn${showAll ? ' bc-mode-btn--on' : ''}`}
              onClick={() => !showAll && handleToggle()}>
              הכל
            </button>
          </div>

          {/* 2. Time dropdown */}
          <div className="bc-dd-wrap" ref={timeDdRef}>
            <button
              className="bc-dd-btn"
              onClick={() => { setTimeOpen(v => !v); setCapOpen(false); }}>
              {activeTabLabel} <span className="bc-dd-arrow">{timeOpen ? '▴' : '▾'}</span>
            </button>
            {timeOpen && (
              <div className="bc-dd-menu">
                {currentTabs.map(t => (
                  <button key={t.id}
                    className={`bc-dd-item${activeTab === t.id ? ' bc-dd-item--on' : ''}`}
                    onClick={() => {
                      asset === 'crypto' ? handleTab(t.id) : setActiveTab(t.id);
                      setTimeOpen(false);
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Market Cap dropdown */}
          <div className="bc-dd-wrap" ref={capDdRef}>
            <button
              className="bc-dd-btn"
              onClick={() => { setCapOpen(v => !v); setTimeOpen(false); }}>
              MARKET CAP{capFilter !== 'all' ? `: ${capLabel}` : ''}
              <span className="bc-dd-arrow">{capOpen ? '▴' : '▾'}</span>
            </button>
            {capOpen && (
              <div className="bc-dd-menu">
                {CAP_OPTS.map(c => (
                  <button key={c.id}
                    className={`bc-dd-item${capFilter === c.id ? ' bc-dd-item--on' : ''}`}
                    onClick={() => {
                      if (asset === 'stocks') handleCap(c.id);
                      else setCapFilter(c.id);   /* saved for when user switches to stocks */
                      setCapOpen(false);
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT: asset toggle + close */}
        <div className="bc-controls-right">
          <div className="bc-asset-toggle">
            <button
              className={`bc-asset-btn${asset === 'crypto' ? ' bc-asset-btn--on' : ''}`}
              onClick={() => asset !== 'crypto' && handleAsset('crypto')}>
              🪙 קריפטו
            </button>
            <button
              className={`bc-asset-btn${asset === 'stocks' ? ' bc-asset-btn--on' : ''}`}
              onClick={() => asset !== 'stocks' && handleAsset('stocks')}>
              📈 מניות
            </button>
          </div>
          <button className="bc-close-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

      </div>

      {/* ── Canvas / loading states (position: relative for overlay) ── */}
      <div style={{ position: 'relative' }}>
        {curStatus === 'idle' && (
          <div className="bc-state"><span>בחר סוג נכס</span></div>
        )}
        {curStatus === 'loading' && (
          <div className="bc-state">
            <div className="bc-spinner" />
            <span>{asset === 'crypto' ? 'טוען קריפטו...' : 'טוען מניות...'}</span>
          </div>
        )}
        {curStatus === 'error' && (
          <div className="bc-state bc-state--err">
            <span>⚠ שגיאה בטעינה</span>
            <button onClick={() =>
              asset === 'crypto' ? window.location.reload() : fetchStocks(capRef.current)
            }>נסה שוב</button>
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

        {/* ── Bubble detail overlay ── */}
        {selectedBubble && (
          <BubbleDetail
            bubble={selectedBubble}
            asset={asset}
            coinsData={cryptoCoinsRef.current}
            defaultPeriod={asset === 'stocks' ? activeTab : undefined}
            onClose={() => setSelectedBubble(null)}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="bc-footer">
        <span className="bc-live-dot">● LIVE</span>
        <span className="bc-credit">
          {asset === 'crypto' ? 'CoinGecko' : 'TradingView'}
        </span>
        <button className="bc-manual-btn" onClick={onManualSearch}>
          🔍 סריקה ידנית
        </button>
      </div>
    </div>
  );
}
