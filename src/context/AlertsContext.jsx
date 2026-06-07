import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AlertsContext = createContext(null);

const STORAGE_KEY = 'beepai_alerts';
const loadAlerts  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
const saveAlerts  = (arr) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {} };

// ── Sound beep via Web Audio API ──────────────────────────────
let _audioCtx = null;
function getAudio() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}
let _lastBeep = 0;
export function playBeep() {
  const now = Date.now();
  if (now - _lastBeep < 2500) return;
  _lastBeep = now;
  try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {}
  try {
    const ctx = getAudio();
    [0, 0.38, 0.76].forEach(t => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.30);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.32);
    });
  } catch {}
}

// ── Browser notification ──────────────────────────────────────
export function fireNotification(symbol, message) {
  try {
    if (Notification.permission === 'granted') {
      new Notification(`⚡ BEEP AI — ${symbol}`, {
        body: message,
        icon: '/favicon.ico',
        tag:  `alert-${symbol}-${Date.now()}`,
      });
    }
  } catch {}
}

// ── Fetch price ───────────────────────────────────────────────
const CRYPTO_MAP = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT', DOGE: 'DOGEUSDT' };

async function fetchPrice(symbol) {
  const sym = symbol.toUpperCase();
  // Crypto from Binance
  if (CRYPTO_MAP[sym]) {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${CRYPTO_MAP[sym]}`);
    const d = await r.json();
    return parseFloat(d.price);
  }
  // Stocks/Gold/etc from our server proxy
  const r = await fetch(`/api/market?symbol=${encodeURIComponent(sym)}`);
  const d = await r.json();
  return d.price;
}

// ── Provider ──────────────────────────────────────────────────
export function AlertsProvider({ children }) {
  const [alerts, setAlerts]   = useState(loadAlerts);
  const [banner, setBanner]   = useState(null); // { symbol, message }
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  // Persist on change
  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  // Unlock audio on first gesture
  useEffect(() => {
    const unlock = () => { try { getAudio(); } catch {} };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click',      unlock, { once: true });
  }, []);

  // ── Add alert ──
  const addAlert = useCallback((alert) => {
    const newAlert = {
      id:        Date.now(),
      symbol:    alert.symbol.toUpperCase().trim(),
      direction: alert.direction, // 'above' | 'below'
      target:    parseFloat(alert.target),
      type:      alert.type || 'price', // 'price' | 'change_pct'
      note:      alert.note || '',
      triggered: false,
      createdAt: Date.now(),
    };
    setAlerts(prev => [newAlert, ...prev]);
  }, []);

  // ── Remove alert ──
  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Reset triggered ──
  const resetAlert = useCallback((id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false } : a));
  }, []);

  // ── Clear banner ──
  const clearBanner = useCallback(() => setBanner(null), []);

  // ── Price check loop — every 30 seconds ──
  useEffect(() => {
    const check = async () => {
      const active = alertsRef.current.filter(a => !a.triggered);
      if (!active.length) return;

      // Group by symbol to avoid duplicate fetches
      const symbols = [...new Set(active.map(a => a.symbol))];
      const prices  = {};
      await Promise.allSettled(
        symbols.map(sym =>
          fetchPrice(sym).then(p => { if (p) prices[sym] = p; }).catch(() => {})
        )
      );

      setAlerts(prev => prev.map(alert => {
        if (alert.triggered) return alert;
        const price = prices[alert.symbol];
        if (!price) return alert;

        const triggered =
          alert.direction === 'above' ? price >= alert.target :
          alert.direction === 'below' ? price <= alert.target : false;

        if (triggered) {
          const msg = `${alert.symbol} ${alert.direction === 'above' ? '↑' : '↓'} $${alert.target.toLocaleString()}`;
          playBeep();
          fireNotification(alert.symbol, msg);
          setBanner({ symbol: alert.symbol, message: msg });
          setTimeout(() => setBanner(null), 8000);
          window.dispatchEvent(new CustomEvent('beepai:alertFired', { detail: { alert, price } }));
          return { ...alert, triggered: true, triggeredAt: Date.now(), triggeredPrice: price };
        }
        return alert;
      }));
    };

    check(); // immediate first check
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const activeCount = alerts.filter(a => !a.triggered).length;

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, removeAlert, resetAlert, activeCount, banner, clearBanner }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertsContext);
