# Healthcheck — 2026-07-30

**זמן ריצה:** 2026-07-30T15:33:48.094Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 129ms | BTC=$64,611 · vol=$31.69B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 234ms | index=28 (Fear) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1125ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 176ms | AAPL=$331.57 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 307ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2100ms | 249 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 649ms | 15 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 308ms | index=38 |
| ⚠️ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 433ms | HTTP 502 |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
