/**
 * NewsPage.jsx
 *
 * שינוי B: תוכן הפיד (Twitter + Whale Alerts) הועבר לכאן.
 * טאב "חדשות" מציג כעת את תוכן הפיד במקום את ה-TradingView widget.
 * שם הטאב נשאר "חדשות" (לא שונה).
 */
import TwitterPage from './TwitterPage';

export default function NewsPage() {
  return <TwitterPage />;
}
