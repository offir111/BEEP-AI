import './NotFoundPage.css';

export default function NotFoundPage({ navigate }) {
  return (
    <div className="notfound-wrap">
      <div className="notfound-icon">🔍</div>
      <h2 className="notfound-title">דף לא נמצא</h2>
      <p className="notfound-sub">העמוד שחיפשת אינו קיים</p>
      <button className="notfound-btn" onClick={() => navigate('home')}>
        ← חזור לדף הבית
      </button>
    </div>
  );
}
