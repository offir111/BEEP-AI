import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AlertsContext = createContext(null);

// ── Storage ───────────────────────────────────────────────────
const STORAGE_KEY    = 'beepai_alerts';
const TECH_KEY       = 'beepai_tech_alerts';
const FIXED_SLOTS    = 'beepai_fixed_slots';
const CUSTOM_SLOTS   = 'beepai_custom_slots';

const load  = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save  = (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const DEFAULT_FIXED  = ['BTC','ETH','SOL','AAPL','NVDA','GOLD'];
const DEFAULT_CUSTOM = ['','','','','',''];

// ── Sound ──────────────────────────────────────────────────────
let _audioCtx = null;
let _lastBeep = 0;

function getAudio() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

export function playBeep() {
  const now = Date.now();
  if (now - _lastBeep < 2500) return;
  _lastBeep = now;
  try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {}
  try {
    const ctx = getAudio();
    [0, 0.38, 0.76].forEach(t => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.30);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.32);
    });
  } catch {}
}

// ── OS Notification ───────────────────────────────────────────
export async function fireNotification(symbol, body) {
  try {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(`⚡ BEEP AI — ${symbol}`, {
        body, icon: '/icon-192.svg', badge: '/icon-192.svg',
        tag: `alert-${symbol}-${Date.now()}`,
        vibrate: [400, 150, 400, 150, 600],
        requireInteraction: true,
      });
    } else if (Notification.permission === 'granted') {
      new Notification(`⚡ BEEP AI — ${symbol}`, { body, icon: '/icon-192.svg' });
    }
  } catch {}
}

// ── App badge ─────────────────────────────────────────────────
function updateAppBadge(count) {
  try {
    if (count > 0) navigator.setAppBadge?.(count);
    else           navigator.clearAppBadge?.();
  } catch {}
}

// ── Price fetch ───────────────────────────────────────────────
const CRYPTO_BINANCE = { BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT', BNB:'BNBUSDT', XRP:'XRPUSDT', DOGE:'DOGEUSDT', ADA:'ADAUSDT', AVAX:'AVAXUSDT' };

export async function fetchLivePrice(symbol) {
  const sym = symbol.toUpperCase().replace('GOLD','GC=F');
  if (CRYPTO_BINANCE[sym]) {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${CRYPTO_BINANCE[sym]}`);
    const d = await r.json();
    return parseFloat(d.price);
  }
  const r = await fetch(`/api/market?symbol=${encodeURIComponent(sym)}`);
  const d = await r.json();
  return d.price || null;
}

// ── Duration helpers ──────────────────────────────────────────
export function makeExpiry(duration) {
  if (duration === 'eod') {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
  }
  if (duration === 'year') return Date.now() + 365 * 86400000;
  return null; // forever
}

// ── Provider ──────────────────────────────────────────────────
export function AlertsProvider({ children }) {
  const [alerts,      setAlerts]      = useState(() => load(STORAGE_KEY, []));
  const [techAlerts,  setTechAlerts]  = useState(() => load(TECH_KEY, []));
  const [fixedSlots,  setFixedSlots]  = useState(() => load(FIXED_SLOTS, DEFAULT_FIXED));
  const [customSlots, setCustomSlots] = useState(() => load(CUSTOM_SLOTS, DEFAULT_CUSTOM));
  const [toasts,      setToasts]      = useState([]);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  // Persist
  useEffect(() => { save(STORAGE_KEY, alerts); updateAppBadge(alerts.filter(a => !a.triggered).length); }, [alerts]);
  useEffect(() => { save(TECH_KEY, techAlerts); }, [techAlerts]);
  useEffect(() => { save(FIXED_SLOTS, fixedSlots); }, [fixedSlots]);
  useEffect(() => { save(CUSTOM_SLOTS, customSlots); }, [customSlots]);

  // Unlock audio on first gesture
  useEffect(() => {
    const u = () => { try { getAudio(); } catch {} };
    window.addEventListener('touchstart', u, { once: true });
    window.addEventListener('click',      u, { once: true });
  }, []);

  // ── Add alert (UX-05: deduplication check) ──
  const addAlert = useCallback((alert) => {
    const sym = alert.symbol.toUpperCase().trim();
    const tgt = parseFloat(alert.target);
    const isDuplicate = alertsRef.current.some(
      a => !a.triggered && a.symbol === sym && a.direction === alert.direction && Math.abs(a.target - tgt) < 0.0001
    );
    if (isDuplicate) return null; // caller can detect null to show warning toast

    const a = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      symbol:    sym,
      direction: alert.direction,
      target:    tgt,
      duration:  alert.duration || 'forever',
      expiresAt: makeExpiry(alert.duration || 'forever'),
      note:      alert.note || '',
      triggered: false,
      triggeredAt:    null,
      triggeredPrice: null,
      created:   Date.now(),
      seen:      false,
    };
    setAlerts(prev => [a, ...prev]);
    return a;
  }, []);

  // ── Edit alert (update target price) ──
  const editAlert = useCallback((id, newTarget) => {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, target: parseFloat(newTarget), triggered: false, triggeredAt: null } : a
    ));
  }, []);

  // ── Remove alert ──
  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Reset triggered ──
  const resetAlert = useCallback((id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false, triggeredAt: null } : a));
  }, []);

  // ── Mark all seen ──
  const markSeen = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, seen: true })));
  }, []);

  // ── Clear all for symbol ──
  const clearSymbol = useCallback((symbol) => {
    setAlerts(prev => prev.filter(a => a.symbol !== symbol.toUpperCase()));
  }, []);

  // ── Clear all ──
  const clearAll = useCallback(() => setAlerts([]), []);

  // ── Dismiss toast ──
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── CSV export ──
  const exportCSV = useCallback(() => {
    const rows = [['Symbol','Direction','Target','Status','Triggered At','Created']];
    alerts.forEach(a => rows.push([
      a.symbol, a.direction === 'above' ? 'מעל' : 'מתחת',
      a.target, a.triggered ? 'הופעל' : 'פעיל',
      a.triggeredAt ? new Date(a.triggeredAt).toLocaleString('he-IL') : '',
      new Date(a.created).toLocaleString('he-IL'),
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `beepai-alerts-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [alerts]);

  // ── Price check loop — every 30s ──
  useEffect(() => {
    const check = async () => {
      const active = alertsRef.current.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
      if (!active.length) return;

      const symbols = [...new Set(active.map(a => a.symbol))];
      const prices = {};
      await Promise.allSettled(
        symbols.map(sym => fetchLivePrice(sym).then(p => { if (p) prices[sym] = p; }).catch(() => {}))
      );

      const fired = [];
      setAlerts(prev => prev.map(alert => {
        if (alert.triggered) return alert;
        if (alert.expiresAt && Date.now() >= alert.expiresAt) return { ...alert, triggered: true, triggeredAt: Date.now(), expiredOut: true };
        const price = prices[alert.symbol];
        if (!price) return alert;
        const hit = alert.direction === 'above' ? price >= alert.target : price <= alert.target;
        if (hit) {
          fired.push({ ...alert, triggeredPrice: price });
          return { ...alert, triggered: true, triggeredAt: Date.now(), triggeredPrice: price };
        }
        return alert;
      }));

      // Fire toasts + sounds staggered
      fired.forEach((alert, i) => {
        setTimeout(() => {
          const msg = `${alert.symbol} ${alert.direction === 'above' ? '↑ חצה מעל' : '↓ חצה מתחת'} $${alert.target.toLocaleString()}`;
          playBeep();
          fireNotification(alert.symbol, msg);
          const toastId = `toast-${Date.now()}-${i}`;
          setToasts(prev => [...prev, { id: toastId, symbol: alert.symbol, message: msg, direction: alert.direction }]);
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 9000);
          window.dispatchEvent(new CustomEvent('beepai:alertFired', { detail: alert }));
        }, i * 1500);
      });
    };

    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const activeCount = alerts.filter(a => !a.triggered).length;
  const unseenFired = alerts.filter(a => a.triggered && !a.seen).length;

  return (
    <AlertsContext.Provider value={{
      alerts, techAlerts, addAlert, editAlert, removeAlert, resetAlert,
      markSeen, clearSymbol, clearAll, exportCSV,
      fixedSlots, setFixedSlots, customSlots, setCustomSlots,
      setTechAlerts,
      toasts, dismissToast,
      activeCount, unseenFired,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertsContext);
