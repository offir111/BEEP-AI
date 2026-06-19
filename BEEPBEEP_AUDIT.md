# BEEPBEEP_AUDIT.md — מיפוי BEEP BEEP ושכפול ל-TGM (משימה 0)

> תאריך: 2026-06-19 · אפליקציית מקור: **BEEP BEEP** (`Desktop\BEEP BEEP Winning Stock Scanner\stb-src`)
> יעד: **BEEP AI** → רובוט **TGM · מעבדת מנועי לידים** (`src/tgm/`).
> מטרה: להחליף נתוני MOCK בנתונים אמיתיים, ע"י שכפול הדפוס שכבר עובד — לא בנייה מאפס.

---

## 1. מה נמצא ב-BEEP BEEP (סריקה כוללת)

| תחום | קיים ב-BEEP BEEP? | קובץ / ממשק | הערה |
|------|:-:|------|------|
| ציטוט חי (quote) | ✅ | `api/quotes.js` (Finnhub→Stooq→Yahoo v7), `src/services/api.js` | cascade עם crumb/cookie + caching |
| **נרות OHLC היסטוריים** | ✅ | `src/services/api.js → fetchAggs / fetchAggsForTf` (Massive/Binance), וב-**BEEP AI** כבר `api/candles.js` (Yahoo v8, 1d→1y) | **זה המקור שנדרש ל-TGM** |
| WebSocket חי | ✅ | `src/services/massiveWS.js`, `binanceWS.js`, `PolygonContext.jsx` | לא נדרש ל-backtest; רלוונטי ל-paper trading |
| אחסון ענן | ✅ | `api/_redis.js` (Upstash REST) | get/set/del/sadd/smembers/hset/hgetall/isReady |
| תזמון (cron) | ✅ | `vercel.json crons` + `api/alerts-cron.js` (`* * * * *`) | דפוס לקרון |
| שעות מסחר | ✅ (חלקי) | `api/gainers.js → getMode(h,m)` (ET, 4:00/9:30/16:00/20:00) | אין טיפול חגים מפורש |
| **Paper Trading / מסחר וירטואלי** | ❌ **לא קיים** | — | אין פוזיציות וירטואליות, אין TP/SL חי |
| **Backtest / סימולציה** | ❌ **לא קיים** | — | האפליקציה היא סורק+התראות בלבד |
| env vars | ✅ | `FINNHUB_TOKEN, MASSIVE_KEY, UPSTASH_REDIS_REST_URL/_TOKEN, VAPID_*, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET` | מפתחות ב-Vercel בלבד |

**מסקנה מרכזית:** ב-BEEP BEEP **אין** מנגנון Paper Trading או Backtest לשכפל. לכן:
- שכבת ה**קישוריות לנתונים** (נרות היסטוריים) — **שוכפלה** (ראה §2).
- ה**Backtest** וה-**Paper Trading** — **נבנו** ב-TGM, אך על גבי תשתיות BEEP BEEP/BEEP AI הקיימות (אותו `api/candles.js`, אותו `api/_redis.js`, אותו דפוס cron מ-`tgm-cron.js`).

---

## 2. מה שוכפל ל-TGM (קישוריות)

המזל: **BEEP AI כבר מכיל את אותו דפוס** מ-BEEP BEEP בקובץ `api/candles.js` —
Yahoo v8 chart (`query1→query2`), `interval=1d → range=1y`, מחזיר `{candles:[{time,open,high,low,close,volume}]}`.
זהו בדיוק המקור שנדרש לשלושת צרכי TGM. לכן **לא נדרש endpoint חדש** — TGM צורך את הקיים.

### הקבצים החדשים/המעודכנים ב-TGM:
| קובץ | תפקיד |
|------|------|
| `src/tgm/data/liveProvider.js` (חדש) | מושך סדרת נרות שנתית לכל סימבול דרך `apiUrl('/api/candles?...')` (אותו `apiUrl` של שאר האפליקציה, תומך APK), cache בזיכרון, throttle (concurrency 4). |
| `src/tgm/data/seriesMath.js` (חדש) | כל המתמטיקה הטהורה על סדרת נרות: SMA50/200, ATR%, RVol, שיא/שפל 52ש׳, התנגדות, חלון forward. משותף ל-LIVE ול-MOCK → אין שני מסלולי חישוב. |
| `src/tgm/data/dataLayer.js` (שוכתב) | בורר מקור פר-סימבול: **LIVE אם נטען, אחרת MOCK**. חושף `loadLiveData()`, `getDailyBar`, `getDailySeries`, `getForwardBars`, `dataMode()`. לכל נר `_source:'live'|'mock'`. |
| `src/tgm/data/mockMarketData.js` (עודכן) | נוסף `mockSeries()` — סדרה שנתית דטרמיניסטית רציפה (דריפט פר-מניה) לסיווג מגמה ולגיבוי כש-LIVE לא זמין. |

### שלושת צרכי TGM — חוברו למקור האמיתי:
1. **לידים** — המנועים סורקים את היקום (35 מניות US אמיתיות) ומחשבים סיגנלים מתוך **נרות אמיתיים** (RVol, ATR%, פריצת 52ש׳/התנגדות) ולא מ-MOCK.
2. **סימולציית גמול (TP/SL)** — OHLC היסטורי **אחרי** תאריך הסיגנל (`getForwardBars`), תומך בחלון forward נטול look-ahead.
3. **מגמה שנתית** — סדרת סגירות יומית לשנה (`getDailySeries`, ~252 ימים) → SMA50/200 + תשואה שנתית אמיתיים.

### שקיפות (LIVE / MOCK):
- חיווי בכותרת המעבדה: 🟢 **LIVE** / 🟡 **חלקי** / ⚪ **MOCK** — לפי כמה סימבולים נטענו חי בפועל.
- כפתור **"🔌 התחבר לנתונים חיים"** מושך את כל היקום, ואז מחשב מחדש את כל ההיסטוריה על הנתונים האמיתיים.
- כל ליד נושא `dataSource:'live'|'mock'`; כל תג מגמה נושא `source`. **אסור** ש-MOCK יוצג כ-LIVE — וזה נאכף.
- **קטליסט ו-M&A עדיין MOCK** (אין פיד 8-K/13D/M&A מחובר) — מסומן בבירור. TODO לחיבור SEC EDGAR / Benzinga.

---

## 3. אימות שהחיבור עובד (LIVE אמיתי)

`scripts/test-tgm-live.mjs` (מול dev server): **33/33 סימבולים נטענו חי**.
דוגמה אמיתית (AAPL): 250 ימי מסחר, SMA50≈288, SMA200≈268, סווג 🟢 "מגמה עולה — תיקון בריא", תשואה שנתית +47%.
פיזור מגמות אמיתי: `AAPL🟢 NVDA🟢 TSLA🟡 AMD🟢(+299%) PLTR🔴 INTC🟢(+474%) PFE🟡 F🟢 SOFI🔴 MARA🟡`.

`scripts/test-tgm-engines.mjs` (MOCK, ללא רשת): **22/22** בדיקות לוגיקה עברו.

---

## 4. החלטות ארכיטקטורה (שהתקבלו עצמאית)

1. **שימוש חוזר ב-`api/candles.js` במקום endpoint חדש** — הוא כבר מממש בדיוק את הדפוס מ-BEEP BEEP (Yahoo v8, cascade). שכפול = צריכה שלו, לא כתיבה מחדש.
2. **שכבת math אחת (`seriesMath`) ל-LIVE ול-MOCK** — מונע סטיית-לוגיקה בין דמו לאמת, ומאפשר בדיקות Node.
3. **prefetch אסינכרוני → cache → קריאות סינכרוניות** — שומר על המנועים/המעריך סינכרוניים (אפס שינוי בממשק שלהם) תוך הזנת נתונים אמיתיים.
4. **תיקון look-ahead + חלון forward** (ראה `TGM_BREAKOUT_AUDIT.md`) — נדרש כי "OHLC אחרי תאריך הסיגנל" משמעו כניסה ביום D+1, לא ביום הסיגנל. שונה במסגרת משימה 0 כי הנתונים האמיתיים מחייבים זאת.
5. **MOCK נשאר כ-fallback מסומן** — לא הוסר. סימבול שכשל במשיכה → MOCK עם תג DEMO, לא נתון ריק.
6. **קטליסט/M&A נשארו MOCK** — אין מקור חינמי אמין ל-8-K/13D/M&A; סומן TODO ולא הוסתר.
