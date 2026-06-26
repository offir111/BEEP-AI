# BOOK MAP — סיכום

רובוט order-flow אמיתי בסגנון Bookmap, מוזן כולו מנתוני Binance בזמן אמת. אין שום
נתון מומצא — כשפיד נופל/מתיישן מוצג 🔴 והציור נעצר, לעולם לא מזויף ערך.

## מה נבנה (הכל תחת `src/robots/bookmap/`)
- **שכבת נתונים** (`data/`): `OrderBookState` (ספר L2 מלא, מיזוג snapshot+diff לפי רצף U/u
  בדיוק לפי תיעוד Binance), `BinanceDepthFeed` (`@depth@100ms` + snapshot דרך פרוקסי,
  resync על שבירת רצף, backoff), `BinanceTradesFeed` (`@aggTrade`), `BinanceBookTicker`
  (`@bookTicker`), `SymbolList` (exchangeInfo → זוגות USDT אמיתיים + חיפוש),
  `RecordReplayStore` (הקלטת ticks אמיתיים ל-IndexedDB עם rolling cap).
- **מנועים** (`engine/`): `HeatmapEngine` (מטריצת time×price, typed arrays, נרמול חלק),
  `VolumeBubblesEngine`, `BBOEngine` (+זיהוי ספיגה), `IcebergStopsEngine`
  (refill=iceberg, sweep חד-כיווני=stop run), `MarketPulseEngine` (סף דינמי).
- **רינדור** (`render/`): `HeatmapCanvas` (Canvas יחיד, rAF יחיד, offscreen scroll-blit
  לביצועים, 30fps+), `VolumeBubblesLayer`, `BBORibbon`, `TimePriceAxes`, `DOMPanel`,
  `PulseFeed`.
- **בקרות** (`controls/`): `SymbolPicker`, `ZoomControls` (Nanosecond Zoom עד רמת tick),
  `IndicatorToggles` (מתג לכל אינדיקטור), `ReplayControls` (⏵⏸️ scrub 0.5×–10×).
- **עמוד ראשי**: `BookmapRobot.jsx` + `styles/bookmap.css` (RTL, רספונסיבי).

## מה LIVE 🟢 ומה DEMO 🟡
- **LIVE (כל מטבע USDT מ-Binance):** Heatmap, Volume Bubbles, BBO+Spread, DOM, Iceberg/Stops,
  Market Pulse, Record&Replay, Symbol Picker — כולם על נתוני זמן אמת.
- **DEMO 🟡:** (א) One-Click Trading — כפתורי קנה/מכור מסמנים הוראה וירטואלית בלבד, לא נשלחת
  הוראת מסחר אמיתית. (ב) סימבול לא-USDT (מנייתי) — אין עומק ספר חינמי, מוצג באנר DEMO ואין
  פיד מזויף.

## אימות שבוצע
- `npm run build` עובר נקי (164 מודולים).
- 17/17 בדיקות לוגיקה טהורה (`scripts/bm_smoke.mjs`): מיזוג snapshot+diff, drop של אירוע
  ישן, qty=0 מוחק רמה, זיהוי gap→resync, binning של Heatmap, צבע/גודל בועות, זיהוי sweep.
- פרוקסי `/api/binance?ep=depth` ו-`ep=exchangeInfo` מחזירים נתוני Binance אמיתיים (dev).

## הסרה
1. מחק את התיקייה `src/robots/bookmap/`.
2. בטל את 2 נקודות המגע ב-`src/App.jsx` ו-`src/pages/HomePage.jsx` (ראה `INTEGRATION.md`).
3. (אופציונלי) הסר `'depth','exchangeInfo'` ממערך `ALLOWED` ב-`api/binance.js`.
