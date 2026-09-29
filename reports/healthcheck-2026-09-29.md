# Healthcheck — 2026-09-29

**זמן ריצה:** 2026-09-29T18:49:59.029Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 8 · ⚠️ 0 · ❌ 1

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 698ms | BTC=$83,631.09 · vol=$1.14B (binance-mirror) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 250ms | index=73 (Greed) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 1515ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 224ms | AAPL=$331.39 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 378ms | 31 gainers |
| ❌ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 1593ms | empty gainers result |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 709ms | 10 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 362ms | index=32 |
| ✅ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 493ms | 27 leads stored |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
