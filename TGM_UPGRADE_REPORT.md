# TGM_UPGRADE_REPORT.md — דוח סיום (משימות 0–4)

> תאריך: 2026-06-19 · אפליקציה: BEEP AI · רכיב: TGM → מעבדת מנועי לידים (`src/tgm/`)
> תיקיית גיבוי: `backup_20260619_095443/` (כל הקבצים שנגעו בהם, לפני השינוי).

## 1. סיכום קצר לכל משימה

| # | משימה | מה נעשה | מצב |
|---|------|---------|-----|
| 0 | חיבור API | שכבת נתונים אמיתית (Yahoo דרך `/api/candles`) שוכפלה לתוך TGM. בורר מקור פר-סימבול LIVE→MOCK. | ✅ LIVE אומת 33/33 |
| 1 | אודיט פריצה | אותר ותוקן באג look-ahead שניפח את ה-90.9%. | ✅ 89.9%→37.6% |
| 2 | חוסן 8%↔10% | תשתית רב-ספים + טבלת השוואה צד-לצד. ה-TP לא שונה. | ✅ פריצה −5.5pp |
| 3 | מגמה שנתית | מסווג 🟢/🟡/🔴 (SMA50/200, תשואה, תיקון) + פילטר + מיון ב-UI. | ✅ |
| 4 | Paper Trading | מעקב חי קדימה על Redis + cron בשעות המסחר. | ✅ נבנה (ממתין ל-Upstash ב-Vercel) |

## 2. דוח שכפול מ-BEEP BEEP
מלא ב-[`BEEPBEEP_AUDIT.md`](BEEPBEEP_AUDIT.md). תמצית: ב-BEEP BEEP **אין** Paper Trading/Backtest
לשכפל — שכבת ה**קישוריות** שוכפלה (התברר ש-BEEP AI כבר מכיל את אותו דפוס ב-`api/candles.js`),
וה-Backtest/Paper Trading **נבנו** על תשתיות קיימות (`api/candles.js`, `api/_redis.js`, דפוס `tgm-cron`).
**עדיין MOCK:** מנועי קטליסט ו-M&A (אין פיד 8-K/13D/M&A אמיתי) — מסומן בבירור ב-UI.

## 3. אודיט פריצה
מלא ב-[`TGM_BREAKOUT_AUDIT.md`](TGM_BREAKOUT_AUDIT.md). **הבאג אומת:** על 109 לידי פריצה
אמיתיים — השיטה הישנה (כניסה ב-open של יום הסיגנל + ספירת TP לפני בדיקת SL) נתנה 89.9%
(כמעט בדיוק ה-90.9% שהוצג); המתוקנת (D+1 + forward + SL-לפני-TP) נותנת 37.6%, PF 1.12.

## 4. טבלת השוואה 8% מול 10% (נתונים אמיתיים)
| מנוע | win-rate @8% | win-rate @10% | ירידה |
|------|:-:|:-:|:-:|
| כל המנועים | 37.2% (206/554) | 32.7% (181/554) | −4.5pp |
| ⚡ מומנטום | 27.9% (12/43) | 20.9% (9/43) | −7.0pp |
| 🚀 פריצה | 37.6% (41/109) | 32.1% (35/109) | −5.5pp |
| 📰 קטליסט* | 36.7% (108/294) | 34.4% (101/294) | −2.4pp |
| 🤝 M&A* | 41.7% (45/108) | 33.3% (36/108) | −8.3pp |

ירידות מתונות (≤8pp) → ה-edge הקטן שקיים יציב יחסית, לא "בקושי נגע ב-8%".
*קטליסט/M&A: מחיר אמיתי אך אירועים MOCK — לא edge אמיתי.

## 5. דוח Paper Trading
- **תזמון:** `vercel.json` cron `*/15 13-21 * * 1-5` (UTC) → `api/tgm-paper-cron`. `api/_marketClock.js`
  שומר על פעולה רק בשעות המסחר הרגילות (ET, כולל חגי NYSE 2025–26). רץ בענן גם כשהמחשב סגור.
- **אחסון פוזיציות:** Upstash Redis (`api/_redis.js`): hash `tgm:paper:open` / `tgm:paper:closed` + `tgm:paper:meta`.
- **זרימה:** פתיחה פעם ביום בפתיחת השוק (מחיר אמיתי ≈ פתיחה, גודל $5,000/פוזיציה מ-$100K);
  סגירה אוטומטית ב-TP +8% / SL −4% או בתום חלון 10 ימי מסחר (אותו כלל כמו ה-backtest).
- **איך מתחילים מעקב חי:** (1) להגדיר `UPSTASH_REDIS_REST_URL`/`_TOKEN` ב-Vercel; (2) deploy;
  ה-cron יתחיל אוטומטית בפתיחת המסחר הבאה. כפתור "▶️ פתח/עדכן עכשיו" מפעיל ידנית.
- **שקיפות:** מסומן LIVE PAPER עם תאריך התחלה; גילוי נאות על slippage/spread/מילוי שמוצג במסך.

## 6. קבצים ששונו/נוצרו + 5 הקומיטים
- **משימה 0** `b9f38b3` — `liveProvider.js`, `seriesMath.js`, `dataLayer.js`, `evaluator.js`, `mockMarketData.js`, `trend.js`, `store.js`, `stats.js`, `baseEngine.js`, `TgmEngines.jsx/.css`, `BEEPBEEP_AUDIT.md`, tests.
- **משימה 1** `5631c3d` — `scripts/audit-breakout.mjs`, `TGM_BREAKOUT_AUDIT.md`.
- **משימה 2** `a27af53` — `compare.js`, `TgmEngines.jsx/.css`, `scripts/audit-compare.mjs`.
- **משימה 3** `67e1637` — `TgmEngines.jsx/.css` (תג/פילטר/מיון מגמה), `scripts/test-tgm-engines.mjs`.
- **משימה 4** `81f3ecf` — `api/_marketClock.js`, `api/_tgmPaperEngine.js`, `api/tgm-paper-cron.js`, `api/tgm-paper.js`, `src/tgm/data/universe.js`, `src/tgm/paper.js`, `TgmEngines.jsx/.css`, `vercel.json`, tests.

## 7. תיקיית גיבוי
`C:\Users\Admin\Desktop\beep-ai\backup_20260619_095443\` — `src/tgm/` המלא + `api/{candles,market,_redis,tgm-cron}.js` + `vercel.json`.

## 8. החלטות ארכיטקטורה (עצמאיות) ולמה
1. **שימוש חוזר ב-`api/candles.js`** במקום endpoint חדש — הוא כבר מממש את דפוס Yahoo v8 מ-BEEP BEEP.
2. **שכבת math אחת (`seriesMath`) ל-LIVE ול-MOCK** — מונע סטיית-לוגיקה, מאפשר בדיקות Node.
3. **prefetch→cache→קריאות סינכרוניות** — נתונים אמיתיים בלי לשנות את ממשק המנועים הסינכרוני.
4. **תיקון look-ahead + חלון forward במשימה 0** — "OHLC אחרי תאריך הסיגנל" מחייב כניסה ב-D+1.
5. **Paper Trading נבנה (לא שוכפל)** — כי ב-BEEP BEEP אין כזה; נבנה על Redis/cron הקיימים.
6. **קטליסט/M&A נשארו MOCK** — אין מקור חינמי אמין; סומן TODO ולא הוסתר.
7. **גודל פוזיציה קבוע $5K מ-$100K** — פשטות והשוואתיות; ניתן לכוונן.

## 9. הערות
- **חישוב מחדש בלחיצה:** "🔌 התחבר לנתונים חיים" מושך נתונים אמיתיים ומחשב מחדש את כל ההיסטוריה.
- **לידים "פתוחים":** עם נתונים אמיתיים, לידים בני פחות מ-10 ימי מסחר נשארים `open` (חלון forward טרם נסגר) — לא נספרים כהצלחה/כישלון.
- **בדיקות:** `node scripts/test-tgm-engines.mjs` (27) · `test-tgm-live.mjs` (6, צריך dev server) · `test-tgm-paper.mjs` (7).
