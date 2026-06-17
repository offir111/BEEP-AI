# AUDIT_REPORT.md — ביקורת מלאה של BEEP AI

> נתיב: `C:\Users\Admin\Desktop\beep-ai` · React 19 + Vite 5 · Vercel
> תאריך ביקורת: 2026-06-17 · בוצע על הקוד בפועל (קריאת קבצים), אומת מול endpoints חיים בדב.
> מקרא סטטוס: 🟢 **LIVE** (נתון חי אמיתי) · 🟡 **DEMO** (אצור/קבוע, מסומן) · 🔴 **שבור** · ✅ = תוקן בסבב הזה.

## טבלת ביקורת ראשית

| # | פיצ'ר | מטרה | מקור נתונים | מקבל נתונים חיים? | סטטוס לפני | אחרי התיקון |
|---|---|---|---|---|---|---|
| 1 | טיקר/גרף BTC ראשי | מחיר BTC | TradingView iframe + Binance WS | כן | 🟢 LIVE | 🟢 LIVE |
| 2 | אריחי קריפטו (BTC/ETH/SOL/BNB) | מחיר חי | Binance WS `miniTicker` | כן | 🟢 LIVE | 🟢 LIVE |
| 3 | אריחי מניות (QQQ/S&P/SPCX/top-gainer) | מחיר חי | `/api/tv-screener`, `/api/market` (Yahoo) | חלקית | 🟡 ריק כשסגור | 🟢 LIVE ✅ (Stooq/chart fallback) |
| 4 | F&G קריפטו | סנטימנט | `api.alternative.me/fng` | כן | 🟢 LIVE | 🟢 LIVE |
| 5 | F&G מניות | סנטימנט | `/api/fng-stocks` (CNN proxy) | כן | 🟢 LIVE | 🟢 LIVE |
| 6 | HIT MAP (heatmap) | מפת חום | TradingView embeds | כן | 🟢 LIVE | 🟢 LIVE |
| 7 | מפת בועות + סיגנלים | breakout/vol/mom | CoinGecko + Binance mirror + `/api/tv-screener` | כן | 🟢 LIVE | 🟢 LIVE |
| 8 | GAINERS | מובילים | `/api/tv-screener` (31 מניות) + `/api/crypto-gainers` (249 מטבעות) | כן | 🟢 LIVE | 🟢 LIVE |
| 9 | **Model SMC** | 8 מניות מוסדיות | `/api/market` (Yahoo) דרך LiveQuoteContext | לא כשסגור | 🔴 אריחים ריקים | 🟢 LIVE ✅ |
| 10 | **Model BIT** | BTC בלבד | Binance WS | מחיר כן, נפח לא | 🔴 נפח `NaNB$` | 🟢 LIVE ✅ |
| 11 | Model W | סורק קריפטו | Binance WS + perf JSON ב-GitHub | מחיר כן | 🟡 סיגנל היוריסטי | 🟡 מחיר LIVE, סיגנל מסומן |
| 12 | **Model Grid** | גריד-בוט BTC | GitHub JSON חיצוני + Binance WS | מחיר כן | 🔴 נפח $0.00B, רמות מחוץ לטווח, APR 0% | 🟢/🟡 ✅ (מרכוז מקומי + APR) |
| 13 | TGM — סורק טלגרם | לידים מטלגרם | `/api/tgm-telegram` → Binance check | כן | 🟢 LIVE, win-rate תקין | 🟢 LIVE |
| 14 | TGM — מעבדת מנועים | 4 מנועי מניות | `src/tgm/data/dataLayer.js` = **mock** | לא | 🟡 SIMULATION (מסומן) | 🟡 SIMULATION (מסומן) |
| 15 | Daily AI | חדשות/מומנטום | `NEWS[]` קבוע → `/api/scan` (Yahoo) | חלקית | 🟡 DEMO | 🟡 DEMO (מסומן) |
| 16 | eToro | מחירים + סוחרים | מחירים `LiveQuoteContext`, סוחרים קבועים | חלקית | מחיר 🟢 / סוחרים 🟡 | מחיר 🟢 / סוחרים 🟡 (מסומן) |
| 17 | **FINVIZ** | סריקת תבניות חיה | `/api/finviz-model` | לא — **קובץ חסר (404)** | 🔴 שבור | 🟢 LIVE ✅ (endpoint נוצר) |

## ממצאי שורש (Root cause) לכל באג

### 9 · Model SMC — אריחים ריקים
- כל `StockCard` נרשם דרך `LiveQuoteContext` → `startStockPoll` → `/api/market?symbol=AAPL` (Yahoo).
- **לא** באג CORS (הקריאה proxied). הסיבה: `/api/market` הישן קרא רק `regularMarketPrice` ו-3 fallbacks של Yahoo בלבד; כש-Yahoo החזיר `null` (rate-limit / שוק סגור / חסימת UA) — האריח נשאר על שלד לנצח (`loading = price == null`, `error = false`).
- **תיקון:** הוספת crumb-session + v8 chart-meta + **Stooq** ל-`api/market.js` (תמיד מחזיר מחיר סגירה אחרון), והוספת `stale`/`marketState`/`noData`. ה-card מציג מחיר סגירה + תווית "סגירה/טרום/אחרי", ובכשל מלא "אין נתון" במקום שלד אינסופי. אומת חי: `AAPL=$300.34`, `^GSPC=7521`.

### 10 · Model BIT — נפח `NaNB$`
- `ModelBitPage` שורה 116 קרא `btc.vol`, אך אובייקט `btc` נבנה ללא `vol`, ו-`LiveQuoteContext` מעולם לא פירס את `data.q`/`data.v` מ-Binance.
- **תיקון:** `LiveQuoteContext` מפרס כעת `q` (USDT) ו-`v` (בסיס), חושף `vol` ב-`useQuote`; `ModelBitPage` מציג `fmtVolUsd(btc.vol)` שמחזיר `—` על חוסר נתון. אומת: `vol=$0.94B`.

### 12 · Model Grid — נפח / טווח / APR
- נפח: שורה 55 קבעה `vol:null` → `null/1e9=0` → "$0.00B".
- רמות 73,160–81,906 מול מחיר ~65,000 ו-APR 0%: מגיעים **מילולית** מ-JSON חיצוני (`offir111/model-grid`) שהתיישן; האפליקציה רק הציגה אותו. אין באפליקציה קוד שמייצר רמות/APR.
- **תיקון:** `src/engine/gridModel.js` חדש — `buildCenteredGrid()` ממרכז רמות סביב המחיר החי (ATR או ±6%), `computeRealizedApr()` מחשב APR מנתוני בוט אמיתיים, `theoreticalApr()` נותן APR תאורטי מסומן כשאין נתונים. הדף משתמש ב-JSON החיצוני רק אם הוא טרי והמחיר בטווח (🟢 LIVE), אחרת גריד מקומי + תווית 🟡 DEMO שקופה. אומת ב-19 בדיקות יחידה (`scripts/test-grid.mjs`).

### 17 · FINVIZ — סריקה חיה 404
- `FinvizPage` קרא ל-`/api/finviz-model` שלא היה קיים → כל סריקה נכשלה.
- **תיקון:** נוצר `api/finviz-model.js` (שכפול דפוס `api/finviz-scan.js` מהאם: Yahoo crumb → Stooq → v8 chart-meta), בפורמט multi-pattern שה-UI מצפה לו. אומת חי: 9 מניות ב-2 תבניות (AMD +14%, HOOD +17%, COIN +10.5%).

### 13-14 · TGM — win-rate
- **תקין כבר.** הסורק החי (`engine/tgmStats.js buildRanking`): מכנה = `win`+`loss` בלבד; `open`/`error` לא נספרים → לא מנפחים. סף `MIN_SAMPLE_FOR_RATE=10`. המעבדה (`src/tgm/stats.js`): `winRate=wins/resolved`, errored מוחרג. שני הדנומינטורים סופרים נכון. (המעבדה רצה על mock — מסומן.)

## באגים נלווים שתוקנו
- **יציבות WebSocket:** הוסף reconnect עם exponential backoff (2→4→…→30ש׳) + סטטוס `wsStatus` (`connecting/live/disconnected`). דפי BIT/Grid מציגים 🔴 "מנותק — מתחבר מחדש" במקום נתון ישן בשקט.
- **תאימות APK:** `LiveQuoteContext` עבר לקרוא דרך `apiUrl()` (נתיב יחסי נכשל ב-WebView).
