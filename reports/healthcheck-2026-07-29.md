# Healthcheck — 2026-07-29

**זמן ריצה:** 2026-07-29T15:31:53.247Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 191ms | BTC=$63,994 · vol=$23.51B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 406ms | index=29 (Fear) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1075ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 362ms | AAPL=$339.98 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 544ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2150ms | 249 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 1005ms | 10 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 263ms | index=34 |
| ⚠️ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 333ms | HTTP 502 |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
