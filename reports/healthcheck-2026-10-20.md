# Healthcheck — 2026-10-20

**זמן ריצה:** 2026-10-20T11:14:10.159Z  
**בסיס בדיקה (app):** https://beep-ai.vercel.app  
**תוצאה כוללת:** 🟢 תקין — ✅ 9 · ⚠️ 0 · ❌ 0

| סטטוס | פיד | קבוצה | זמן | פירוט |
|---|---|---|---|---|
| ✅ 🔑 | Crypto BTC (price + volume) | Crypto | 184ms | BTC=$81,540 · vol=$23.70B (coingecko) |
| ✅ | Crypto Fear & Greed (alternative.me) | Sentiment | 82ms | index=55 (Greed) |
| ✅ | https://beep-ai.vercel.app/api/health | App | 863ms | 3/3 feeds healthy |
| ✅ | https://beep-ai.vercel.app/api/market?symbol=AAPL | Stocks | 176ms | AAPL=$339.58 (live) |
| ✅ | https://beep-ai.vercel.app/api/tv-screener?period=1d | Stocks | 264ms | 31 gainers |
| ✅ | https://beep-ai.vercel.app/api/crypto-gainers | Crypto | 2000ms | 250 coins |
| ✅ | https://beep-ai.vercel.app/api/finviz-model | Stocks | 594ms | 9 stocks across 2 patterns |
| ✅ | https://beep-ai.vercel.app/api/fng-stocks | Sentiment | 216ms | index=23 |
| ✅ | https://beep-ai.vercel.app/api/tgm-leads | TGM | 492ms | 28 leads stored |

> 🔑 = פיד קריטי · ⚠️ = אזהרה לא־קריטית · נוצר ע"י `scripts/healthcheck.mjs`
