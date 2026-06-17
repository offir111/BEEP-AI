# BEEP AI

סורק/דשבורד מסחר (קריפטו + מניות) — React 19 + Vite 5, פרוס ב-Vercel, נעטף ל-APK עם Capacitor.
מבוסס על אפליקציית האם **BEEP BEEP** (לשעבר S.T.B). RTL עברית, ערכת נושא כהה.

## הרצה

```bash
npm install --legacy-peer-deps
npm run dev            # http://localhost:5173  (vite מריץ גם את api/* מקומית)
npm run build          # build לפרודקשן → dist/
npm run healthcheck    # בדיקת בריאות מקורות (ציבוריים)
npm run test:grid      # בדיקות יחידה למנוע הגריד
```

## ארכיטקטורה — החלטות מפתח

- **שכבת נתונים חיים:** `src/context/LiveQuoteContext.jsx` מנתב לפי סוג סמל — קריפטו → Binance WebSocket (`@miniTicker`, ישיר מהדפדפן, CORS פתוח), מניות → polling ל-`/api/market` (proxy בצד שרת). חושף `useQuote(sym)` (price/change/high/low/**vol**/stale/marketState/noData) ו-`useWsStatus()`.
- **למה proxy למניות:** הדפדפן לא יכול לקרוא ל-Yahoo/Stooq ישירות (CORS + חשיפת מפתח). כל קריאת מניות עוברת serverless ב-`api/`. דפוס זה שוכפל מהאם.
- **עמידות מקור מניות (`api/market.js`):** מפל — Yahoo v7 (crumb+cookie) → Yahoo v8 chart → **Stooq CSV**. תמיד מחזיר מחיר (אחרון אם השוק סגור) עם דגלי `stale`/`marketState` — כך אריחים אף פעם לא נשארים ריקים.
- **נפח Binance:** `d.q` = נפח USDT, `d.v` = נפח בסיס. נקרא בקונטקסט ומוצג עם `fmtVolUsd()` (מחזיר `—` על חוסר, אף פעם לא `NaN`).
- **Model Grid (`src/engine/gridModel.js`):** כשה-JSON החיצוני של הבוט מיושן/מחוץ-לטווח — מחושב גריד מקומי ממורכז על המחיר החי (ATR או ±6%) ו-APR (ממומש אם יש נתוני בוט, אחרת תאורטי מסומן). מצב מקומי מסומן 🟡 DEMO.
- **שקיפות LIVE/DEMO:** כל פיד מציג מצב — 🟢 חי / 🟡 דמו / 🔴 מנותק. שום דמו לא מתחזה ל-LIVE.
- **יציבות WS:** reconnect עם exponential backoff (2→30ש׳) + סטטוס חיבור גלוי.
- **APK:** כל קריאות `/api/*` חייבות `apiUrl()` מ-`src/utils/apiBase.js` (נתיב יחסי נכשל ב-WebView).
- **ניתוב:** מתג page-state פשוט ב-`src/App.jsx` (אין react-router).

## בדיקות בריאות יומיות

- `api/health.js` — endpoint בריאות זמן-אמת (503 בכשל קריטי).
- `scripts/healthcheck.mjs` — בודק נגישות/טריות/שפיות לכל פיד, כותב `reports/healthcheck-YYYY-MM-DD.md`.
- `.github/workflows/healthcheck.yml` — GitHub Action יומי (פתיחת וול-סטריט + בוקר קריפטו), commit אוטומטי של הדוח. הגדר משתנה `HEALTH_BASE` ל-URL הפרודקשן.

## מקורות נתונים

הכל על **free tier** — אין צורך במנוי בתשלום. ראה `DATA_SOURCES.md` ו-`SUBSCRIPTION_DECISION.md`.
שדרוג אופציונלי בעלות אפס: `FINNHUB_TOKEN` (ניתן לעשות reuse למפתח מ-BEEP BEEP) לזמן-אמת יציב יותר על מניות.

## תיעוד

| קובץ | תוכן |
|---|---|
| `PARENT_APP_REFERENCE.md` | דפוסי אפליקציית האם ומה שוכפל |
| `AUDIT_REPORT.md` | ביקורת מלאה + ממצאי שורש |
| `DATA_SOURCES.md` | מפת כל הפידים + סטטוס |
| `SUBSCRIPTION_DECISION.md` | החלטת מנוי (עברית) |
| `FINAL_REPORT.md` | דוח סופי before/after (עברית) |

## להמשך (App Store / PWA)
אפליקציית web טהורה לא עולה ישירות לאפסטור — נדרשת עטיפת Capacitor (קיימת) או PWA תקין. לפני העלאה: לוודא manifest + service worker מלאים, אפס שגיאות console, וכל מצבי טעינה/שגיאה מטופלים. `npm run build` עובר נקי.
