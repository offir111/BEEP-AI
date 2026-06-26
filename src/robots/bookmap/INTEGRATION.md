# BOOK MAP — נקודות מגע חיצוניות (Integration)

כל קוד הרובוט מבודד תחת `src/robots/bookmap/`. מחוץ לתיקייה נגענו **בשתי נקודות מגע** בלבד
(+ הרחבת פרוקסי backend אחת). להסרה מלאה — מחק את התיקייה והפוך את השינויים הבאים.

## 1. Route — `src/App.jsx`
שלוש שורות נוספו:
- `import BookmapRobot from './robots/bookmap/BookmapRobot';`
- `'bookmap'` נוסף למערך `VALID_PAGES`.
- `bookmap: '🗺️ BOOK MAP — עומק ספר חי'` נוסף ל-`PAGE_TITLES`.
- שורת רינדור: `{page === 'bookmap' && <BookmapRobot navigate={navigate} />}`

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

## שימוש בקומפוננטה משותפת ללא עריכה
`RobotNavTabs` נטענת לתצוגה בלבד (ייבוא קריאה) ולא נערכה. לא נגענו ב-NavBar.

## הערה
ה-`RobotNavTabs` לא כולל לשונית "bookmap" (לא ערכנו את הרכיב המשותף), ולכן בעמוד
ה-BOOK MAP אין לשונית פעילה משלו — הניווט לשאר הרובוטים עדיין עובד.
