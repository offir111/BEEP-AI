# Healthcheck — 2026-09-29

**זמן ריצה:** 2026-09-29T12:30:35.099Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 0 · ❌ 1

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 827ms | BTC=$84,247.26 · vol=$1.28B (binance-mirror) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 245ms | index=73 (Greed) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1189ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 211ms | AAPL=$337.1 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 329ms | 31 gainers |
| ❌ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 1478ms | empty gainers result |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 732ms | 12 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 505ms | index=34 |
| ✅ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 436ms | 27 leads stored |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
