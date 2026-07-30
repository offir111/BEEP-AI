# Healthcheck — 2026-07-30

**זמן ריצה:** 2026-07-30T08:36:33.858Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 223ms | BTC=$64,191 · vol=$28.21B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 487ms | index=28 (Fear) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1196ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 228ms | AAPL=$338.81 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 405ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2245ms | 249 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 721ms | 12 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 402ms | index=34 |
| ⚠️ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 418ms | HTTP 502 |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
