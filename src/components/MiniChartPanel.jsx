/**
 * MiniChartPanel — תצוגה מקדימה של גרף הקנבס שבנינו (זהה לאם), עם לחיצה לגרף המלא.
 * הגרף כאן הוא תצוגה בלבד (pointer-events מבוטל) — האינטראקציה המלאה והקווים הנגררים
 * בעמוד הגרפים. symbol prop (למשל "BTC", "AAPL", "GOLD").
 */
import './MiniChartPanel.css';
import AlertChartPanel from './AlertChartPanel';

const CRYPTO_SET = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','DOT','AVAX','MATIC','LINK','DOGE','LTC','ATOM']);

export default function MiniChartPanel({ navigate, symbol = 'BTC' }) {
  const short    = (symbol || 'BTC').toUpperCase();
  const isCrypto = CRYPTO_SET.has(short);

  return (
    <div className="mcp-wrap" role="button" tabIndex={0}
      onClick={() => navigate('charts')}
      onKeyDown={(e) => e.key === 'Enter' && navigate('charts')}
      aria-label={`פתח גרף ${symbol} מלא`}
    >
      {/* גרף הקנבס שבנינו — תצוגה בלבד (pointer-events מבוטל ב-CSS), הלחיצה מנווטת */}
      <div className="mcp-iframe">
        <AlertChartPanel symbol={short} isCrypto={isCrypto} interval="1d" />
      </div>

      {/* Transparent click overlay */}
      <div className="mcp-overlay">
        <span className="mcp-hint">📊 {symbol} — לחץ לגרף מלא</span>
      </div>
    </div>
  );
}
