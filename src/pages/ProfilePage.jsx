/**
 * ProfilePage.jsx — עמוד היוזר.
 *
 * זהות המשתמש (עיגול צהוב + כניסה אחרונה) מוצגת ב-topbar (App.jsx, PageTopBar).
 * הגוף כולו הוא אזור המעקב + הסורק (ProfileScanner): כפתורי מעקב קטנים שטוענים
 * את הגרף, שורת חיפוש, וגרף נרות מלא. בידוד מלא — לא נוגע בגרף המקורי,
 * בכפתורי הבית או ברובוטים.
 */
import ProfileScanner from '../components/ProfileScanner';
import './ProfilePage.css';

export default function ProfilePage() {
  return (
    <div className="pf-wrap">
      <ProfileScanner />
    </div>
  );
}
