import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import LiveQuoteContext from './LiveQuoteContext';
import { Capacitor } from '@capacitor/core';

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
        body, icon: '/icon-192.png', badge: '/icon-192.png',
        tag: `alert-${symbol}-${Date.now()}`,
        vibrate: [400, 150, 400, 150, 600],
        requireInteraction: true,
      });
    } else if (Notification.permission === 'granted') {
      new Notification(`⚡ BEEP AI — ${symbol}`, { body, icon: '/icon-192.png' });
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

// ── Device ID (stable per browser) ───────────────────────────
const DEVICE_ID_KEY = 'beepai_device_id';
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) { id = `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(DEVICE_ID_KEY, id); }
  return id;
}

// ── Push registration ─────────────────────────────────────────
function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function registerPush(alerts = []) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const r = await fetch('/api/vapid-public');
    if (!r.ok) return;
    const { publicKey } = await r.json();
    if (!publicKey) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;

    // Always unsubscribe old subscription and create fresh one to prevent stale endpoints in Redis
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe().catch(() => {});
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(publicKey),
    });

    const resp = await fetch('/api/alerts-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), subscription: sub.toJSON(), alerts }),
    });
    if (!resp.ok) console.warn('[BEEP push] register failed', await resp.text());
  } catch (e) {
    console.warn('[BEEP push] registerPush error:', e);
  }
}

// ── Price fetch ───────────────────────────────────────────────
const CRYPTO_BINANCE = { BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT', BNB:'BNBUSDT', XRP:'XRPUSDT', DOGE:'DOGEUSDT', ADA:'ADAUSDT', AVAX:'AVAXUSDT', BSOL:'BSOLUSDT', KEEL:'KEELBTC' };

export async function fetchLivePrice(symbol) {
  const sym = symbol.toUpperCase().replace('GOLD','GC=F');
  if (CRYPTO_BINANCE[sym]) {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${CRYPTO_BINANCE[sym]}`);
    const d = await r.json();
    return parseFloat(d.price);
  }
  const r = await fetch(`/api/market?symbol=${encodeURIComponent(sym)}`);
  if (!r.ok) return null;
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

// ── FCM Registration (Android APK only) ──────────────────────
const API_BASE = Capacitor.isNativePlatform() ? 'https://beep-ai.vercel.app' : '';

async function registerFCMToken(fcmToken, alerts = []) {
  try {
    const activeAlerts = alerts.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
    await fetch(`${API_BASE}/api/alerts-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), fcmToken, alerts: activeAlerts }),
    });
    console.log('[BEEP FCM] token registered with server');
  } catch (e) {
    console.warn('[BEEP FCM] token registration failed:', e);
  }
}

// ── Provider ──────────────────────────────────────────────────
export function AlertsProvider({ children }) {
  const [alerts,      setAlerts]      = useState(() => load(STORAGE_KEY, []));
  const [techAlerts,  setTechAlerts]  = useState(() => load(TECH_KEY, []));
  const [fixedSlots,  setFixedSlots]  = useState(() => load(FIXED_SLOTS, DEFAULT_FIXED));
  const [customSlots, setCustomSlots] = useState(() => load(CUSTOM_SLOTS, DEFAULT_CUSTOM));
  const [toasts,      setToasts]      = useState([]);
  const alertsRef     = useRef(alerts);
  alertsRef.current   = alerts;

  // ── Connect to LiveQuoteContext for real-time WebSocket prices ──
  const liveCtx       = useContext(LiveQuoteContext);
  const liveQuotesRef = useRef({});
  useEffect(() => { liveQuotesRef.current = liveCtx?.quotes || {}; }, [liveCtx?.quotes]);

  // Subscribe active alert symbols to LiveQuoteContext so WebSocket opens for them
  useEffect(() => {
    if (!liveCtx?.subscribe) return;
    const active = alerts.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
    const unique  = [...new Set(active.map(a => a.symbol))];
    if (unique.length) liveCtx.subscribe(unique);
  }, [alerts, liveCtx?.subscribe]);

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

  // ── Push registration: on load (1s delay) and whenever alerts change ──
  useEffect(() => {
    const t = setTimeout(() => registerPush(alertsRef.current), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Re-register whenever active alerts change (server needs updated list)
    const active = alerts.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
    if (active.length > 0) registerPush(alerts);
  }, [alerts]);

  // ── FCM Registration for Android APK ──────────────────────
  const fcmTokenRef = useRef(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removed = false;
    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        // Create the notification channel the server's FCM payload targets
        try {
          await PushNotifications.createChannel({
            id: 'beepai_alerts',
            name: 'BEEP AI התראות',
            description: 'התראות מחיר',
            importance: 5, // MAX — heads-up + sound
            visibility: 1,
            sound: 'default',
            vibration: true,
          });
        } catch {}

        await PushNotifications.register();
        await PushNotifications.addListener('registration', async (token) => {
          if (removed) return;
          fcmTokenRef.current = token.value;
          console.log('[BEEP FCM] token received:', token.value.slice(0, 20) + '...');
          await registerFCMToken(token.value, alertsRef.current);
        });
        await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[BEEP FCM] registration error:', err);
        });
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[BEEP FCM] foreground notification:', notification.title);
        });
      } catch (e) {
        console.warn('[BEEP FCM] setup error:', e);
      }
    })();
    return () => { removed = true; };
  }, []);

  // Re-sync FCM token with server whenever alerts change
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !fcmTokenRef.current) return;
    const active = alerts.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
    if (active.length > 0) registerFCMToken(fcmTokenRef.current, alerts);
  }, [alerts]);

  // ── Core check engine (used by both real-time and fallback paths) ──
  const runCheck = useCallback((extraPrices = {}) => {
    const active = alertsRef.current.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
    if (!active.length) return;

    const quotes = liveQuotesRef.current;
    const now    = Date.now();

    // Fast pre-check: skip state update if nothing could possibly trigger
    const shouldUpdate = active.some(alert => {
      if (alert.expiresAt && now >= alert.expiresAt) return true;
      if (alert.created && now - alert.created < 6000) return false;
      const price = quotes[alert.symbol]?.price ?? extraPrices[alert.symbol];
      if (!price || price <= 0) return false;
      return alert.direction === 'above' ? price >= alert.target : price <= alert.target;
    });
    if (!shouldUpdate) return;

    const fired = [];
    setAlerts(prev => prev.map(alert => {
      if (alert.triggered) return alert;
      if (alert.expiresAt && now >= alert.expiresAt)
        return { ...alert, triggered: true, triggeredAt: now, expiredOut: true };
      // Grace period: skip brand-new alerts for 6s to avoid false positives on creation
      if (alert.created && now - alert.created < 6000) return alert;

      const price = quotes[alert.symbol]?.price ?? extraPrices[alert.symbol];
      if (!price || price <= 0) return alert;

      const hit = alert.direction === 'above' ? price >= alert.target : price <= alert.target;
      if (hit) {
        fired.push({ ...alert, triggeredPrice: price });
        return { ...alert, triggered: true, triggeredAt: now, triggeredPrice: price };
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
  }, []);

  // ── Real-time path: check immediately when WebSocket price arrives ──
  useEffect(() => {
    if (!liveCtx?.quotes || Object.keys(liveCtx.quotes).length === 0) return;
    runCheck();
  }, [liveCtx?.quotes, runCheck]);

  // ── Fallback path: HTTP poll for stocks / symbols not yet in LiveQuoteContext ──
  useEffect(() => {
    const poll = async () => {
      const active = alertsRef.current.filter(a => !a.triggered && (!a.expiresAt || Date.now() < a.expiresAt));
      if (!active.length) return;

      // Only HTTP-fetch symbols not already covered by the live WebSocket
      const quotes      = liveQuotesRef.current;
      const needsFetch  = [...new Set(active.map(a => a.symbol))].filter(sym => !quotes[sym]?.price);

      if (!needsFetch.length) { runCheck(); return; }

      const prices = {};
      await Promise.allSettled(
        needsFetch.map(sym => fetchLivePrice(sym).then(p => { if (p) prices[sym] = p; }).catch(() => {}))
      );
      runCheck(prices);
    };

    poll();
    const iv = setInterval(poll, 30000); // 30s is plenty — crypto covered by WebSocket above
    return () => clearInterval(iv);
  }, [runCheck]);

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

  // ── Edit alert (update target, direction, duration, note) ──
  const editAlert = useCallback((id, updates) => {
    setAlerts(prev => prev.map(a => {
      if (a.id !== id) return a;
      const u = (typeof updates === 'object' && updates !== null) ? updates : { target: updates };
      return {
        ...a,
        ...(u.target    !== undefined ? { target: parseFloat(u.target) }              : {}),
        ...(u.direction !== undefined ? { direction: u.direction }                    : {}),
        ...(u.duration  !== undefined ? { duration: u.duration, expiresAt: makeExpiry(u.duration) } : {}),
        ...(u.note      !== undefined ? { note: u.note }                              : {}),
        triggered: false, triggeredAt: null,
      };
    }));
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
