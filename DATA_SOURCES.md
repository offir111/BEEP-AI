# DATA_SOURCES.md — מפת מקורות הנתונים של BEEP AI

> לכל פיד: סוג · endpoint · מפתח נדרש · סטטוס (חי/דמו/שבור) · הערות.
> מקרא: 🟢 חי · 🟡 דמו/מסומן · 🔴 שבור · ✅ תוקן בסבב הזה.

## קריפטו

| פיד | סוג | endpoint | מפתח | סטטוס |
|---|---|---|---|---|
| מחיר חי (BTC/ETH/SOL/BNB) | WebSocket | `wss://stream.binance.com:9443/stream?streams=*@miniTicker` | — (חינם) | 🟢 |
| **נפח USDT** | WebSocket field | `d.q` ב-miniTicker | — | 🟢 ✅ (היה NaN) |
| יום-פתיחה / klines | REST | `api.binance.com/api/v3/klines` | — | 🟢 |
| מטבעות מובילים | REST proxy | `/api/crypto-gainers` (CoinGecko + Binance mirror) | — | 🟢 (249 מטבעות) |
| נרות קריפטו | REST proxy | `/api/crypto-candles`, `/api/binance` (data-api.binance.vision) | — | 🟢 |

## מניות

| פיד | סוג | endpoint | מפתח | סטטוס |
|---|---|---|---|---|
| ציטוט מניה/אינדקס/זהב | REST proxy | `/api/market?symbol=` → Yahoo v7(crumb)→v8 chart→**Stooq** | — (חינם) | 🟢 ✅ |
| גיינרז מניות | REST proxy | `/api/tv-screener?period=` (TradingView scanner) | — | 🟢 (31 מניות) |
| נרות מניות | REST proxy | `/api/candles`, `/api/stock-detail` (Yahoo) | — | 🟢 |
| סריקת מומנטום (Daily) | REST proxy | `/api/scan` (Yahoo batch) | — | 🟢 (תוכן Daily עדיין אצור) |
| **סריקת תבניות FINVIZ** | REST proxy | `/api/finviz-model` (Yahoo→Stooq→chart) | — | 🟢 ✅ (היה 404) |
| חיפוש סמלים | REST proxy | `/api/symbol-search` (Yahoo) | — | 🟢 |

## סנטימנט / חדשות

| פיד | סוג | endpoint | מפתח | סטטוס |
|---|---|---|---|---|
| F&G קריפטו | REST | `api.alternative.me/fng` | — | 🟢 (index=22) |
| F&G מניות | REST proxy | `/api/fng-stocks` (CNN dataviz) | — | 🟢 (index=42) |
| חדשות/AI Daily | proxy + template | `/api/scan` + `/api/ai-diagnostic` (טמפלייט מקומי) | — | 🟡 (ניתוח אצור) |

## רובוטים / מנועים

| פיד | מקור | סטטוס | הערה |
|---|---|---|---|
| Model BIT — פורטפוליו בוט | `oh-my-god-production.up.railway.app` | 🟢/🟡 | מחיר BTC חי; פורטפוליו לפי זמינות הבוט (מסומן DEMO כשלא זמין) |
| Model W — perf log | `raw.githubusercontent.com/offir111/model-w` | 🟢/🟡 | מחיר חי; סיגנל = היוריסטיקה מקומית; perf מ-GitHub |
| Model Grid — portfolio/grid | `raw.githubusercontent.com/offir111/model-grid` | 🟢/🟡 ✅ | מחיר חי; גריד חיצוני אם טרי+בטווח, אחרת **מרכוז מקומי** (`gridModel.js`) |
| TGM — סורק טלגרם | `/api/tgm-telegram`, `/api/tgm-leads` (Upstash) | 🟢 | לידים אמיתיים מ-`t.me/s/`; ענן רק אחרי deploy עם Upstash env |
| TGM — מעבדת מנועים | `src/tgm/data/mockMarketData.js` | 🟡 | **mock דטרמיניסטי** — מסומן; נקודת החלפה יחידה ל-ספק אמיתי |

## אינטגרציות (לא feed)

| רכיב | endpoint/env | סטטוס |
|---|---|---|
| התראות מחיר (cron) | `/api/cron-push` (Vercel cron `* * * * *`) + Firebase FCM + Web Push | תלוי env בפרודקשן |
| TGM cron | `/api/tgm-cron` (`*/10`) + Upstash Redis | תלוי env |
| **Healthcheck** ✅ | `/api/health` + `scripts/healthcheck.mjs` + GitHub Action יומי | חדש — מותקן |

## משתני env (שמות בלבד)

צד שרת: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ADMIN_PIN`, `GROQ_API_KEY`, `PORT`.
**אופציונלי לשדרוג מניות (מומלץ, חינם):** `FINNHUB_TOKEN` — ראה `SUBSCRIPTION_DECISION.md`.
`HEALTH_BASE` (משתנה GitHub Actions) — כתובת הפרודקשן לבדיקה היומית.

## מקורות שאי-אפשר/לא כדאי להשתמש בהם כ-feed
- **TradingView** — לא מוכרים API לנתונים (רק ווידג'טים חינם לגרפים + scanner לא-רשמי). לא לשלם.
- **Finviz** — אין API נקי (סקרייפינג בלבד). לא לשלם; השתמשנו ב-Yahoo/Stooq במקום.
- **Binance** — חינם ומספיק לקריפטו. לא לשלם.
- **Alpha Vantage** — free tier מוגבל מאוד (25 קריאות/יום) — לא מתאים לסורק.
