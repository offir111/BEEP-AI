# BOOK MAP — נקודות מגע חיצוניות (Integration)

כל קוד הרובוט מבודד תחת `src/robots/bookmap/`. מחוץ לתיקייה נגענו **בשתי נקודות מגע** בלבד
(+ הרחבת פרוקסי backend אחת). להסרה מלאה — מחק את התיקייה והפוך את השינויים הבאים.

## 1. Route + full-bleed render — `src/App.jsx`
- `import BookmapRobot from './robots/bookmap/BookmapRobot';`
- `'bookmap'` נוסף למערך `VALID_PAGES`.
- `bookmap: '🗺️ BOOK MAP — עומק ספר חי'` נוסף ל-`PAGE_TITLES` (כותרת ה-PageTopbar המשותפת
  — לא בשימוש יותר בעמוד זה, ראה למטה, אך מושאר לשלמות).
- **Full-bleed (2026-06-26):** העמוד מרונדר ללא ה-chrome המשותף (Header/NavBar/PageTopBar),
  עם סרגל עליון יחיד משלו, דרך early-return ב-`AppInner`:
  ```jsx
  if (page === 'bookmap') { return <BookmapRobot navigate={navigate} />; }
  ```
  שורת הרינדור הישנה בתוך `<main>` הוסרה (מיותרת בגלל ה-early-return).
  זוהי הדרך שאושרה לבידוד: לא נגענו ב-Header/NavBar/PageTopBar עצמם — רק עוקפים אותם לעמוד זה.

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
