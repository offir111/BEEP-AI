# Multibook (אגרגציית ספרים ממספר בורסות) — TODO (נדחה)

commit 11 סומן כ-**TODO** ולא מומש, כדי לא לסכן את יציבות ה-WebSocket החי הקיים.

## למה נדחה
- ל-Coinbase יש WS שונה (`wss://ws-feed.exchange.coinbase.com`, ערוץ `level2`/`level2_batch`)
  עם פורמט snapshot+l2update שונה מ-Binance, וללא REST-snapshot זהה.
- גרנולריות מחיר וגודל-טיק שונים בין הבורסות → אגרגציה דורשת bucketing משותף ונרמול נזילות.
- שתי בורסות = שני order books מלאים בזיכרון + מיזוג בכל tick → עומס ביצועים בטלפון.

## תוכנית מימוש עתידית (כשנחזור לזה)
1. `data/CoinbaseDepthFeed.js` — מקביל ל-`BinanceDepthFeed`: snapshot מ-`level2` + עדכוני
   `l2update`, לתוך `OrderBookState` נפרד.
2. `engine/MultibookAggregator.js` — מקבל N×`OrderBookState`, ממפה לרשת מחיר משותפת
   (אותו `HeatmapEngine.priceToRow`), מסכם נזילות לכל bucket, ומחזיר עמודה מאוחדת.
3. בורר בורסות בסרגל (Binance / Coinbase / מאוחד) + תג מקור לכל פקודת ענק.
4. טיפול ב-symbol mapping (BTCUSDT מול BTC-USD) ובמטבעות שלא קיימים בשתי הבורסות.

## עיקרון
אם מקור לא זמין/נופל — להציג 🔴 לאותו מקור ולהמשיך עם השאר; **לעולם לא לזייף** נזילות.
