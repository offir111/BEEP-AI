import { Capacitor } from '@capacitor/core';

// בדפדפן/דב — נתיב יחסי (אותו origin). באפליקציה (APK) — מצביע ל-backend ב-Vercel,
// כי בתוך ה-WebView אין שרת מקומי שמגיש את /api. תואם לשימוש ב-AlertsContext.
export const API_BASE = Capacitor.isNativePlatform() ? 'https://beep-ai.vercel.app' : '';

export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
