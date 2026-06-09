import './NotFoundPage.css';

export default function NotFoundPage({ navigate }) {
  return (
    <div className="notfound-wrap">
      <div className="notfound-icon">🔍</div>
      <h2 className="notfound-title">דף לא נמצא</h2>
      <p className="notfound-sub">העמוד שחיפשת אינו קיים — אבל הנה מה שאפשר לעשות:</p>
      <button className="notfound-btn" onClick={() => navigate('home')}>
        🏠 חזור לדף הבית
      </button>
      <div className="notfound-quick">
        <button className="notfound-quick-btn" onClick={() => navigate('charts')}>📈 גרפים</button>
        <button className="notfound-quick-btn" onClick={() => navigate('alerts')}>🔔 התראות</button>
        <button className="notfound-quick-btn" onClick={() => navigate('sot')}>🤖 BEEP AI</button>
        <button className="notfound-quick-btn" onClick={() => navigate('crypto')}>₿ קריפטו</button>
      </div>
    </div>
  );
}
