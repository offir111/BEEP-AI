/**
 * ProfileScanner.jsx — סורק מניות בעמוד היוזר.
 *
 * משכפל את עמוד הגרף המלא (ChartsPage) אל תוך עמוד הפרופיל, ללא ניווט החוצה.
 * שימוש חוזר ישיר ב-ChartsPage שומר על בידוד מוחלט: כל לוגיקת הנתונים
 * (קריפטו → Binance, מניות → Yahoo /api/candles), ההתראות, הקווים הנגררים,
 * האינטרוולים והעיצוב — מגיעים איתו בדיוק כמו במקור.
 *
 * רכיבים:
 *   א. שורת חיפוש + "סרוק" → טוען את הסמל לגרף ושומר אותו ככפתור מעקב.
 *   ב. גרף נרות יפניים מלא (ChartsPage), דיפולט BTC/USD.
 *   ג. כפתורי מניות שמורות (Watchlist) — לחיצה טוענת לגרף, ✕ מסירה ממעקב.
 */
import { useState, useCallback } from 'react';
import ChartsPage from '../pages/ChartsPage';
import './ProfileScanner.css';

const DEFAULT_SYM   = 'BTC';
const LS_WATCHLIST  = 'beepai_profile_watchlist';
const MAX_WATCH     = 24;

function loadWatch() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_WATCHLIST));
    if (Array.isArray(s)) return s.map(x => String(x).toUpperCase().trim()).filter(Boolean);
  } catch { /* ignore */ }
  return [];
}
function saveWatch(arr) {
  try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(arr)); } catch { /* ignore */ }
}

export default function ProfileScanner() {
  // הסמל הטעון כרגע בגרף + nonce לטעינה-מחדש מאולצת (גם לאותו סמל).
  const [current, setCurrent]     = useState(DEFAULT_SYM);
  const [loadNonce, setLoadNonce] = useState(0);
  const [query, setQuery]         = useState('');
  const [watch, setWatch]         = useState(loadWatch);

  // טוען סמל לגרף — remount של ChartsPage מבטיח שהנרות נטענים מחדש.
  const loadSymbol = useCallback((sym) => {
    const s = String(sym || '').trim().toUpperCase();
    if (!s) return;
    setCurrent(s);
    setLoadNonce(n => n + 1);
  }, []);

  // "סרוק" — טוען לגרף ושומר ככפתור מעקב (החדש ביותר ראשון).
  const scan = useCallback((raw) => {
    const s = String(raw ?? query).trim().toUpperCase();
    if (!s) return;
    loadSymbol(s);
    setWatch(prev => {
      const next = [s, ...prev.filter(x => x !== s)].slice(0, MAX_WATCH);
      saveWatch(next);
      return next;
    });
    setQuery('');
  }, [query, loadSymbol]);

  const removeWatch = useCallback((sym) => {
    setWatch(prev => {
      const next = prev.filter(s => s !== sym);
      saveWatch(next);
      return next;
    });
  }, []);

  return (
    <div className="psc-wrap" dir="rtl">
      <h2 className="pf-section-title">📡 סורק מניות</h2>

      {/* ── א. שורת חיפוש + סרוק ── */}
      <form className="psc-search-row" onSubmit={e => { e.preventDefault(); scan(); }}>
        <input
          className="psc-search-input"
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="הזן סמל מניה/קריפטו — AAPL · CIFR · BTC"
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="סמל לסריקה"
        />
        <button type="submit" className="psc-scan-btn">🔍 סרוק</button>
      </form>

      {/* ── ג. כפתורי מניות שמורות (Watchlist) ── */}
      {watch.length > 0 && (
        <div className="psc-watch">
          {watch.map(sym => (
            <div key={sym} className={`psc-chip${current === sym ? ' psc-chip--on' : ''}`}>
              <button
                className="psc-chip-load"
                onClick={() => loadSymbol(sym)}
                title={`טען ${sym} לגרף`}
              >
                {sym}
              </button>
              <button
                className="psc-chip-x"
                onClick={() => removeWatch(sym)}
                aria-label={`הסר ${sym} ממעקב`}
                title="הסר ממעקב"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── ב. גרף הנרות המלא — שכפול עמוד הגרף, inline בעמוד היוזר ── */}
      <div className="psc-chart-host">
        <ChartsPage key={`${current}-${loadNonce}`} initialSymbol={current} />
      </div>
    </div>
  );
}
