# SUBSCRIPTION_DECISION.md — החלטת מנוי

> שאלה: האם צריך לשלם על מקור נתונים חדש כדי ש-BEEP AI יעבוד מצוין?
> **תשובה קצרה: לא. אפס מנויים חדשים. הכל עובד על free tier — והוכח חי.**

## 📊 טבלת מקורות מדורגת

| דירוג | מקור | למה | עלות | המלצה |
|---|---|---|---|---|
| ⭐ 1 | **Binance** (קריפטו) | מחיר+נפח חי, WebSocket, 24/7 | חינם | ✅ להשתמש — אל תשלם לעולם |
| ⭐ 2 | **Yahoo Finance** (מניות) | ציטוט+OHLC+pre/post, דרך proxy | חינם | ✅ ראשי למניות |
| ⭐ 3 | **Stooq** (מניות fallback) | מחיר סגירה CSV ללא מפתח | חינם | ✅ גיבוי — מבטיח מחיר גם כששוק סגור |
| ⭐ 4 | **TradingView Scanner** (גיינרז) | סורק מניות, 31+ תוצאות | חינם (לא-רשמי) | ✅ להשתמש כ-scanner; **לא** לקנות API |
| ⭐ 5 | **CoinGecko** (מטבעות) | universe + נפח, 249 מטבעות | חינם | ✅ להשתמש |
| ⭐ 6 | **alternative.me / CNN** (F&G) | סנטימנט קריפטו+מניות | חינם | ✅ להשתמש |
| 🔵 7 | **Finnhub** (זמן-אמת מניות) | ציטוט real-time, 60 קריאות/דקה | **חינם** (free tier) | 🟡 שדרוג אופציונלי — ראה למטה |
| ❌ | **TradingView API** | לא מוכרים API לנתונים | — | אל תשלם |
| ❌ | **Finviz Elite** | אין API נקי (סקרייפינג) | $39+/חודש | אל תשלם — Yahoo/Stooq מחליפים |
| ❌ | **Polygon.io / Massive** | בתשלום, מיותר ל-BEEP AI | $29+/חודש | אל תשלם — Yahoo מספיק |
| ❌ | **Alpha Vantage** | free tier = 25 קריאות/יום | מוגבל | לא מתאים לסורק |

## ✅ ההמלצה החדה

**אל תשלם על שום מקור חדש.** כל הצרכים מכוסים בחינם, והוכחנו חי (ראה "הוכחה" למטה):
- מניות (Model SMC, אריחים, FINVIZ): Yahoo + Stooq דרך `/api/market` ו-`/api/finviz-model`.
- קריפטו (BIT, Grid, gainers): Binance + CoinGecko.
- סנטימנט: alternative.me + CNN.

## 🟡 שדרוג אופציונלי בעלות אפס — Finnhub (לא חובה)

Yahoo עובד, אבל לפעמים מוגבל-קצב בשעות שיא. לזמן-אמת יציב יותר על מניות אפשר להוסיף **Finnhub free tier (60 קריאות/דקה — יותר מספיק ל-8 מניות SMC כל 15ש׳)**.

**הנקודה החשובה:** אפליקציית האם **BEEP BEEP כבר משתמשת ב-`FINNHUB_TOKEN`**. אם כבר הוצאת מפתח שם — **פשוט תעתיק אותו** לפרויקט BEEP AI ב-Vercel. **בלי הרשמה חדשה, בלי תשלום.**

### אם אין לך מפתח עדיין (הרשמה חינם, 2 דקות):
1. היכנס ל-https://finnhub.io/register → הירשם (אימייל בלבד).
2. בלוח הבקרה העתק את ה-**API key** (מתחיל ב-`c...` או דומה).
3. ב-Vercel: פרויקט **beep-ai** → Settings → Environment Variables → **Add**:
   - שם המשתנה: `FINNHUB_TOKEN`
   - ערך: המפתח שהעתקת
   - Environment: Production + Preview
4. Redeploy (Deployments → ⋯ → Redeploy).
5. זהו. `/api/market` ימשיך לעבוד גם בלי זה — Finnhub רק משפר אמינות בשעות שוק.

> **חשוב:** המפתח ב-env בלבד, **לעולם לא בקוד**. (באם יש באג שבו מפתח Alpha Vantage hardcoded — לא לשכפל את זה.)

## 🧪 הוכחה ש-free tier עובד (לפני כל בקשת תשלום)

נבדק חי מול שרת דב מקומי ב-2026-06-17:

| בדיקה | תוצאה חיה |
|---|---|
| `/api/market?symbol=AAPL` | `AAPL=$300.34` (חי, high/low/volume) ✅ |
| `/api/market?symbol=^GSPC` | `S&P=7521.16` ✅ |
| `/api/finviz-model` | 9 מניות ב-2 תבניות (AMD +14%, HOOD +17%) ✅ |
| `/api/tv-screener` | 31 גיינרז מניות ✅ |
| `/api/crypto-gainers` | 249 מטבעות ✅ |
| Binance BTCUSDT | `BTC=$65,348 · vol=$0.94B` ✅ |
| F&G (alternative.me / CNN) | קריפטו=22 / מניות=42 ✅ |

**מסקנה: הכל ירוק על free tier. אין צורך לשלם. ה-Finnhub האופציונלי הוא חינם וניתן לעשות reuse למפתח שכבר קיים ב-BEEP BEEP.**
