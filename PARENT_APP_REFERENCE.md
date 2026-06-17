# PARENT_APP_REFERENCE.md — מה לומדים מאפליקציית האם BEEP BEEP (S.T.B)

> נתיב האם: `C:\Users\Admin\Desktop\BEEP BEEP Winning Stock Scanner\stb-src`
> מטרה: לזהות מה כבר עובד תקין באם, אילו מקורות פעילים, ואילו דפוסים לשכפל ל-BEEP AI.
> **עיקרון על:** מה שעובד באם — משכפלים. רק לפער שבור/חסר — מפתחים חדש.

## 1. פיצ'רים/רובוטים שעובדים תקין באם

| רובוט / פיצ'ר | קובץ | מקור | סטטוס |
|---|---|---|---|
| StockAnalyzer (דף הבית) | `components/StockAnalyzer.jsx` | Massive (גיינרז) + `/api/tv-prices` + `/api/strong-buy` | LIVE |
| Robot W | `pages/ModelWPage.jsx` | מניות `/api/quotes`, קריפטו Binance ישיר | LIVE (+sim fallback) |
| Robot BIT | `pages/ModelBitPage.jsx` | `api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT` כל 10ש׳ | LIVE |
| Robot SMC | `pages/ModelSmcPage.jsx` | `/api/quotes` + Yahoo | LIVE (+sim) |
| Model GRID | `pages/ModelGridPage.jsx` | iframe סטטי `public/model-grid/` | עצמאי/סטטי |
| FINVIZ | `pages/FinvizPage.jsx` → `/api/finviz-scan` | Yahoo/Stooq + ניקוד תבניות | **LIVE** |
| Gold | `pages/GoldPage.jsx` → `/api/gold` | Yahoo `GC=F` | LIVE |
| Daily One | `pages/DailyOnePage.jsx` → `/api/scan-news` | Polygon + Yahoo/Benzinga RSS | LIVE |
| LiveStrip | `components/LiveStrip.jsx` | `usePolygon()` (Massive WS + Binance WS) | LIVE |

## 2. מקורות נתונים פעילים (ספק · טרנספורט · proxy · קובץ)

| ספק | טרנספורט | בשביל | דרך proxy? | קובץ |
|---|---|---|---|---|
| **Binance** | WebSocket `wss://stream.binance.com:9443/stream` (miniTicker) | מחירי קריפטו חיים | **לא — ישיר מהדפדפן** | `src/services/binanceWS.js` |
| **Binance** | REST `/api/v3/ticker/24hr`, `/klines` | ציטוט + היסטוריה | **לא — ישיר** | `src/services/api.js` |
| **Massive.com** (Polygon ממותג) | REST + WS (בתשלום) | מניות snapshot/aggs/RSI/news/gainers | כן → `/api/massive`, WS עם `/api/massive-key` | `api/massive.js`, `src/services/massiveREST.js` |
| **TradingView Scanner** | POST `scanner.tradingview.com/.../scan` | מחירי מניות חיים, strong-buy, crypto-top | כן → `/api/tv-prices`, `/api/strong-buy` | `api/tv-prices.js` |
| **Finnhub.io** | REST `/quote`, `/company-news` | ציטוט מניות זמן-אמת + חדשות | כן → `/api/quotes`, `/api/news` | `api/quotes.js` |
| **Stooq.com** | REST CSV | fallback מניות (חינם, ~15-20 דק׳ דיליי) | כן → `/api/quotes`, `/api/finviz-scan` | `api/quotes.js` |
| **Yahoo Finance** | REST v7/v8 (crumb+cookie) | fallback מניות + OHLC + gold | כן → כמה endpoints | `api/quotes.js`, `api/gold.js` |
| **CryptoCompare / Binance Vision** | REST | מחירי קריפטו בתוך tv-prices | כן | `api/tv-prices.js` |
| **Upstash Redis** | REST | אחסון התראות/משתמשים | פנימי | `api/_redis.js` |
| **Firebase FCM + Web Push** | — | התראות אנדרואיד/דפדפן | `api/alerts-cron.js` | — |

תיקיית `api/` של האם מכילה 26 פונקציות serverless. כולן מסתירות מפתחות ב-env ופותחות CORS.

## 3. הדפוס הקריטי לשכפול — פתרון CORS למניות

הדפדפן לא יכול לקרוא ל-Yahoo/Finnhub/Stooq ישירות (CORS + חשיפת מפתח). **כל קריאת מניות עוברת דרך Vercel Serverless function** שרצה בצד שרת. Binance בלבד נקרא ישירות (CORS פתוח, ללא מפתח).

**`api/quotes.js` — מפל 3 אסטרטגיות (הזהב לשכפול):**
1. **Finnhub** (זמן-אמת, דורש `FINNHUB_TOKEN`) — דורש כיסוי ≥50% מהסמלים, מועשר בנפח מ-Stooq.
2. **Stooq** (CSV חינם ללא מפתח, ~15-20 דק׳ דיליי).
3. **Yahoo v7** עם crumb+cookie session (cache ל-18 דק׳).

תבנית proxy גנרית (`api/massive.js`):
```js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = process.env.MASSIVE_KEY;            // הסוד נשאר בצד שרת
  const upstream = await fetch(`${BASE}${path}?apiKey=${key}`);
  res.status(upstream.status).json(await upstream.json());
}
```

## 4. Binance — קריאת מחיר ו**נפח** (מקור באג ה-NaN)

`miniTicker` payload (`src/services/binanceWS.js`):
```js
const { data: d } = JSON.parse(e.data);   // d.e === '24hrMiniTicker'
price    = parseFloat(d.c);  // מחיר אחרון
open     = parseFloat(d.o);
high     = parseFloat(d.h);
low      = parseFloat(d.l);
volume   = parseFloat(d.v);  // נפח במטבע הבסיס (BTC)
quoteVol = parseFloat(d.q);  // נפח ב-USDT  ← זה מה ש-BEEP AI לא קרא והציג NaN
```
**מסקנה:** `d.q` = נפח ב-USDT, `d.v` = נפח בסיס. כל פורמט נפח ל-`$..B` חייב לקרוא `d.q`.

REST 24hr: `lastPrice`, `priceChangePercent`, `volume`, `quoteVolume`.
REST klines: מערך באינדקסים `[0]=t,[1]=o,[2]=h,[3]=l,[4]=c,[5]=v`.

## 5. פורמט נפח (helper לשכפול)

```js
function fmtVol(v) {
  if (v == null) return '—';
  if (v >= 1e9) return (v/1e9).toFixed(1)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return String(v);
}
```
באם אין util משותף — כל קובץ מגדיר מחדש. ב-BEEP AI מימשנו גרסה בטוחה (`fmtVolUsd`) שמחזירה `—` על `NaN/0/undefined`.

## 6. שמות משתני env (שמות בלבד — אין ערכים)

צד שרת (`process.env`):
`MASSIVE_KEY`, `POLYGON_KEY`, **`FINNHUB_TOKEN`**, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `CRON_SECRET`, `ADMIN_STATS_KEY`.

צד לקוח (Vite): `VITE_VAPID_PUBLIC_KEY`.

> `.env.production` של האם **ריק** — הערכים האמיתיים יושבים ב-Vercel dashboard.
> הערה לשכפול: כמה helpers מנקים BOM (`(process.env[k]||'').replace(/^﻿/,'').trim()`) כי PowerShell מוסיף U+FEFF.
> **באג באם להימנע ממנו:** `api/query.js` מכיל מפתח Alpha Vantage **hardcoded בקוד** — אנטי-דפוס, לא לשכפל.

## 7. שכבת realtime מאוחדת (דפוס מומלץ)

אין `MarketDataProvider` יחיד באם, אבל הדפוס האפקטיבי:
- **WS singleton per-ספק** עם חתימות זהות (`init/subscribe/unsubscribe/onStatus`), כך ש-`binanceWS` ו-`massiveWS` הם drop-in.
- **Context** (`PolygonContext.jsx` / `usePolygon`) שמפצל לפי `isCrypto(symbol)`.
- **`api.js`** עם `fetchQuoteFull` שמסתעף לפי סוג נכס (gold→`/api/gold`, crypto→Binance, stock→tv-prices→massive).

ב-BEEP AI המקבילה היא `LiveQuoteContext.jsx` (Binance WS + polling ל-`/api/market`).

## 8. Healthcheck / Cron באם

- Cron התראות: `vercel.json` → `/api/alerts-cron` כל דקה (FCM + Web Push).
- טריגר חיצוני: cron-job.org + QStash.
- endpoints דיבוג: `api/debug-redis.js`, `api/debug-fcm.js`.
- **אין endpoint בריאות גנרי** באם → ב-BEEP AI פיתחנו חדש (`/api/health` + `scripts/healthcheck.mjs`).

## 9. מה שוכפל ל-BEEP AI מהאם (סיכום)

| נושא | מקור באם | יישום ב-BEEP AI |
|---|---|---|
| מפל מניות עמיד (Yahoo session + Stooq) | `api/quotes.js`, `api/finviz-scan.js` | `api/market.js` (Yahoo crumb + chart + Stooq), `api/finviz-model.js` |
| קריאת נפח Binance `q`/`v` | `binanceWS.js` | `LiveQuoteContext.jsx` (פירוס `d.q`/`d.v`) |
| סורק תבניות FINVIZ | `api/finviz-scan.js` | `api/finviz-model.js` (אותו fetch+score, פורמט multi-pattern) |
| פורמט נפח בטוח | `fmtVol` | `fmtVolUsd` (עם הגנת NaN) |
| המלצה: לא לשלם על Binance/TradingView/Finviz | — | `SUBSCRIPTION_DECISION.md` |

> מה ש**פותח חדש** (לא קיים באם): `src/engine/gridModel.js` (מרכוז גריד + APR), `/api/health`, `scripts/healthcheck.mjs`, `.github/workflows/healthcheck.yml`, מחווני LIVE/DEMO/מנותק שקופים.
