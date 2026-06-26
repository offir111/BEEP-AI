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
- **כפתורי מסחר דמו הוסרו לחלוטין** (2026-06-26) — אין יותר קנה/מכור/תגית DEMO תחת ה-DOM.
- **DEMO 🟡 שנותר:** רק אינדיקטור חיבור לסימבול לא-USDT (מנייתי) — אין עומק ספר חינמי, מוצג
  באנר/תג מצב, ואין שום פיד מזויף. (לא קשור למסחר.)

## אימות שבוצע
- `npm run build` עובר נקי (164 מודולים).
- 17/17 בדיקות לוגיקה טהורה (`scripts/bm_smoke.mjs`): מיזוג snapshot+diff, drop של אירוע
  ישן, qty=0 מוחק רמה, זיהוי gap→resync, binning של Heatmap, צבע/גודל בועות, זיהוי sweep.
- פרוקסי `/api/binance?ep=depth` ו-`ep=exchangeInfo` מחזירים נתוני Binance אמיתיים (dev).

## תיקון וסידור סופי (2026-06-26)
**חלק א' — Layout:** שורת הפקדים (Heatmap / בועות / BBO / Iceberg-Stop + סליידר Zoom)
הועברה לשורה אחת **sticky** ישר מתחת לכותרת — תמיד נראית, לא זזה בגלילה. RTL: ה-Toggles
מימין, סליידר ה-Zoom (±%) בקצה (margin-inline-start:auto). אזור הגרף קיבל גובה קבוע (600px)
ונשאר גדול ומלא; פאנלי ה-DOM וה-Market Pulse חסומים בגובה וגוללים **בתוך הקופסה** שלהם
(overflow פנימי) בלי לדחוף את הגרף.

**חלק ב' — תיקון:** הטווח (price→Y window) עודכן רק כשה-Heatmap דלוק; לכן כיבוי ה-Heatmap
היה מקפיא/מעלים את הבועות/BBO/Iceberg. תוקן — `maybeRecenter` רץ **תמיד** כשיש ספר חי,
ללא תלות במתג ה-Heatmap, כך שכל השכבות נשארות במקום הנכון גם כשה-Heatmap כבוי.

**חלק ג' — סנכרון price→Y:** אומת ותועד שכל שכבות ה-Canvas (Heatmap-base דרך `priceToRow`,
Bubbles, BBO, Iceberg/Stop, קו-מחיר) נגזרות מ-**mapping יחיד** (`yOf` + טווח HeatmapEngine).
בועה במחיר P יושבת בדיוק על פס החום של P. ה-DOM הוא סולם נפרד (לא overlay) ולכן אינו חולק Y.

### מצב 13 הפונקציות (אומת)
| # | פונקציה | מצב |
|---|---------|-----|
| 1 | Liquidity Heatmap | ✅ LIVE — נפרס על הגובה, צבע לפי נזילות, פס בוהק נעלם כשהפקודה נמשכת |
| 2 | Volume Bubbles | ✅ LIVE — גודל∝ווליום, ירוק=קונה/אדום=מוכר אגרסיבי, Y לפי מחיר העסקה |
| 3 | Toggle בועות | ✅ מדליק/מכבה מיידית (state יחיד נקרא בלולאת rAF) |
| 4 | Toggle Heatmap | ✅ מדליק/מכבה מיידית; הטווח נשמר גם כשכבוי |
| 5 | BBO | ✅ LIVE — קווי bid/ask מ-bookTicker, spread אמיתי למעלה, toggle עובד |
| 6 | Iceberg/Stop | ✅ LIVE — מאירוע אמיתי (refill חוזר=iceberg, sweep חד-כיווני=stop), לא טיימר |
| 7 | סליידר Zoom (±%) | ✅ מכווץ/מרחיב טווח מחיר בזמן אמת; תקין אחרי הזזת ה-layout |
| 8 | DOM | ✅ LIVE — asks אדום למעלה / bids ירוק למטה, כמויות אמיתיות, מחיר אמצע מתעדכן, גלילה פנימית |
| 9 | Market Pulse | ✅ LIVE — שורה=עסקה אמיתית (זמן/גודל/מחיר), ▲ירוק/▼אדום, גלילה בתוך הקופסה |
| 10 | בורר מטבע | ✅ רשימת USDT מלאה; בחירה סוגרת WS, מנקה state, מתחבר מחדש, גרף מתאפס |
| 11 | LIVE/מנותק | ✅ 🟢 כשטרי; ניתוק → 🔴 ועצירת ציור, אין נתון ישן בשקט |
| 12 | הקלטה/שחזור | ✅ ticks אמיתיים ל-IndexedDB; play/pause/scrub/מהירות; מונה מתעדכן |
| 13 | מסחר דמו | ❌ הוסר — כפתורי קנה/מכור ותגית DEMO נמחקו מהמסך (2026-06-26) |

## הסרה
1. מחק את התיקייה `src/robots/bookmap/`.
2. בטל את 2 נקודות המגע ב-`src/App.jsx` ו-`src/pages/HomePage.jsx` (ראה `INTEGRATION.md`).
3. (אופציונלי) הסר `'depth','exchangeInfo'` ממערך `ALLOWED` ב-`api/binance.js`.
