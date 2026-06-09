// UX-04: Shared error display component used across all pages
import './ErrorBox.css';

export default function ErrorBox({ message = 'שגיאה בטעינת נתונים', onRetry }) {
  return (
    <div className="errbox" role="alert">
      <span className="errbox-icon">⚠️</span>
      <span className="errbox-msg">{message}</span>
      {onRetry && (
        <button className="errbox-retry" onClick={onRetry} aria-label="נסה שוב לטעון">
          🔄 נסה שוב
        </button>
      )}
    </div>
  );
}
