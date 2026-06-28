/**
 * ProfileScanner.jsx — סורק מניות בעמוד היוזר.
 *
 * משכפל את עמוד הגרף המלא (ChartsPage) אל תוך עמוד הפרופיל, ללא ניווט החוצה.
 * שימוש חוזר ישיר ב-ChartsPage שומר על בידוד מוחלט: כל לוגיקת הנתונים
 * (קריפטו → Binance, מניות → Yahoo /api/candles), ההתראות, הקווים הנגררים,
 * האינטרוולים והעיצוב — מגיעים איתו בדיוק כמו במקור.
 *
 * דיפולט הגרף: BTC/USD.
 */
import { useState, useCallback } from 'react';
import ChartsPage from '../pages/ChartsPage';
import './ProfileScanner.css';

const DEFAULT_SYM = 'BTC';

export default function ProfileScanner() {
  // הסמל הטעון כרגע בגרף + nonce לטעינה-מחדש מאולצת (גם לאותו סמל).
  const [current, setCurrent] = useState(DEFAULT_SYM);
  const [loadNonce, setLoadNonce] = useState(0);

  // טוען סמל לגרף — remount של ChartsPage מבטיח שהנרות נטענים מחדש.
  const loadSymbol = useCallback((sym) => {
    const s = String(sym || '').trim().toUpperCase();
    if (!s) return;
    setCurrent(s);
    setLoadNonce(n => n + 1);
  }, []);

  return (
    <div className="psc-wrap" dir="rtl">
      <h2 className="pf-section-title">📡 סורק מניות</h2>

      {/* גרף הנרות המלא — שכפול עמוד הגרף, inline בתוך עמוד היוזר */}
      <div className="psc-chart-host">
        <ChartsPage key={`${current}-${loadNonce}`} initialSymbol={current} />
      </div>
    </div>
  );
}
