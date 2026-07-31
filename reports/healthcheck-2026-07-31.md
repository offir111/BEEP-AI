# Healthcheck — 2026-07-31

**זמן ריצה:** 2026-07-31T08:57:11.673Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 143ms | BTC=$63,798 · vol=$28.45B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 235ms | index=25 (Extreme Fear) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1034ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 278ms | AAPL=$309.4 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 414ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2157ms | 249 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 664ms | 13 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 309ms | index=39 |
| ⚠️ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 377ms | HTTP 502 |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
