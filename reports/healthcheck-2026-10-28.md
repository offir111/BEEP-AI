# Healthcheck — 2026-10-28

**זמן ריצה:** 2026-10-28T19:02:44.601Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 0 · ❌ 1

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 221ms | BTC=$80,949 · vol=$24.66B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 180ms | index=51 (Neutral) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 917ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 248ms | AAPL=$344.58 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 330ms | 31 gainers |
| ❌ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 1886ms | empty gainers result |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 876ms | 8 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 278ms | index=35 |
| ✅ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 433ms | 28 leads stored |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
