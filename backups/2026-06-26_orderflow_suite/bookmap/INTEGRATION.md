# BOOK MAP — נקודות מגע חיצוניות (Integration)

כל קוד הרובוט מבודד תחת `src/robots/bookmap/`. מחוץ לתיקייה נגענו **בשתי נקודות מגע** בלבד
(+ הרחבת פרוקסי backend אחת). להסרה מלאה — מחק את התיקייה והפוך את השינויים הבאים.

## 1. Route — `src/App.jsx`
- `import BookmapRobot from './robots/bookmap/BookmapRobot';`
- `'bookmap'` נוסף למערך `VALID_PAGES` ו-`PAGE_TITLES`.
- שורת רינדור בתוך `<main className="app-main">` (כמו כל רובוט אחר):
  `{page === 'bookmap' && <BookmapRobot navigate={navigate} />}`
- **העמוד יושב בתוך ה-shell המשותף הסטנדרטי** (Header + NavBar + `app-main` ממורכז עם
  max-width) — בדיוק כמו FINVIZ ושאר הרובוטים. לא נגענו ב-Header/NavBar.
- **נגיעה יחידה (2026-06-26 fix2):** ה-`PageTopBar` המשותף (X אדום + כותרת + "חזור") מוסתר
  *רק* בעמוד זה, כי הרובוט מספק סרגל מאוחד משלו במקומו:
  ```jsx
  {page !== 'bookmap' && <PageTopBar ... />}
  ```
  זו תוספת תנאי בלבד — לא שינוי של `PageTopBar` עצמו.

## 2. כרטיס ברשימת "רובוטים" — `src/pages/HomePage.jsx`
שורה אחת בתוך `<div className="hp-robots">`:
```jsx
<RobotCard icon="🗺️" name="BOOK MAP" desc="Heatmap עומק ספר חי" tag="LIVE" tagColor="#22d3ee" onClick={() => navigate('bookmap')} />
```

## (תשתית) הרחבת פרוקסי Binance — `api/binance.js`
מערך `ALLOWED` הורחב כדי לאפשר משיכת snapshot של עומק הספר ורשימת מטבעות
דרך הפרוקסי הקיים (עוקף חסימת CORS בצד הדפדפן):
```diff
- const ALLOWED = ['ticker/24hr', 'ticker', 'ticker/price', 'klines'];
+ const ALLOWED = ['ticker/24hr', 'ticker', 'ticker/price', 'klines', 'depth', 'exchangeInfo'];
```
זוהי תוספת אדיטיבית בלבד (לא משנה התנהגות קיימת). ה-WebSockets מתחברים ישירות
ל-`wss://stream.binance.com:9443` ואינם דורשים פרוקסי.

## קומפוננטות משותפות — לא נערכו
הרובוט **אינו** מייבא יותר את `RobotNavTabs` המשותף. במקומו יש `controls/RobotMenu.jsx`
פנימי (עותק פרטי של רשימת הרובוטים) שמנווט דרך ה-prop `navigate` הקיים. NavBar/Header
לא נגעו ולא יובאו. כל ניווט הוא דרך `navigate(id)` הקיים.
