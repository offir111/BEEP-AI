# Healthcheck — 2026-06-17

**זמן ריצה:** 2026-06-17T14:18:13.864Z  
**בסיס בדיקה (app):** http://localhost:5173  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Binance BTCUSDT (price + volume) | Crypto | 492ms | BTC=$65,324 · vol=$0.94B |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 430ms | index=22 (Extreme Fear) |
| ✅ | http://localhost:5173/api/health | App | 459ms | 2/3 feeds healthy |
| ✅ | http://localhost:5173/api/market?symbol=AAPL | Stocks | 1004ms | AAPL=$299.97 (live) |
| ✅ | http://localhost:5173/api/tv-screener?period=1d | Stocks | 266ms | 31 gainers |
| ✅ | http://localhost:5173/api/crypto-gainers | Crypto | 5944ms | 249 coins |
| ✅ | http://localhost:5173/api/finviz-model | Stocks | 2313ms | 9 stocks across 2 patterns |
| ✅ | http://localhost:5173/api/fng-stocks | Sentiment | 243ms | index=42 |
| ⚠️ | http://localhost:5173/api/tgm-leads | TGM | 4ms | Redis not configured (local/dev) — informational |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
