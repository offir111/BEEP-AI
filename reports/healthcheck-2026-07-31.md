# Healthcheck — 2026-07-31

**זמן ריצה:** 2026-07-31T15:39:00.404Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 1 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 163ms | BTC=$62,572 · vol=$28.69B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 149ms | index=25 (Extreme Fear) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1357ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 312ms | AAPL=$302.675 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 364ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2142ms | 249 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 707ms | 12 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 641ms | index=40 |
| ⚠️ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 323ms | HTTP 502 |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
