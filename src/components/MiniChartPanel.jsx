/**
 * MiniChartPanel — TradingView mini chart embedded
 * Same width as the ball-widget card was.
 * Click → navigate to full charts page.
 */
import { useState } from 'react';
import './MiniChartPanel.css';

const TV_URL =
  'https://s.tradingview.com/embed-widget/mini-symbol-overview/?' +
  'symbol=BINANCE%3ABTCUSDT' +
  '&locale=he_IL' +
  '&dateRange=1D' +
  '&colorTheme=dark' +
  '&trendLineColor=%234ade80' +
  '&underLineColor=rgba(26%2C10%2C46%2C0.8)' +
  '&underLineBottomColor=rgba(0%2C0%2C0%2C0)' +
  '&isTransparent=true' +
  '&noTimeScale=false' +
  '&width=100%25' +
  '&height=100%25';

export default function MiniChartPanel({ navigate }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="mcp-wrap" role="button" tabIndex={0}
      onClick={() => navigate('charts')}
      onKeyDown={(e) => e.key === 'Enter' && navigate('charts')}
      aria-label="פתח גרף נרות BTC מלא"
    >
      {/* TradingView iframe — pointer-events disabled so overlay captures click */}
      <iframe
        src={TV_URL}
        title="BTC mini chart"
        className="mcp-iframe"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />

      {/* Loading skeleton */}
      {!loaded && (
        <div className="mcp-loading">
          <div className="mcp-loading-bar" />
          <div className="mcp-loading-bar mcp-loading-bar--sm" />
        </div>
      )}

      {/* Transparent click overlay — ensures we navigate on tap */}
      <div className="mcp-overlay">
        <span className="mcp-hint">📊 לחץ לגרף נרות מלא</span>
      </div>
    </div>
  );
}
