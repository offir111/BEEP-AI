/**
 * MiniChartPanel — TradingView mini chart, dynamic symbol
 * symbol prop (e.g. "BTC", "AAPL", "GOLD") → mapped to TradingView format
 * Click → navigate to full charts page.
 */
import { useState, useEffect } from 'react';
import './MiniChartPanel.css';

/* ── Symbol → TradingView format ──────────────────────────── */
const CRYPTO_SET = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','DOT','AVAX','MATIC','LINK','DOGE','LTC','ATOM']);

const SYMBOL_MAP = {
  'BTC':    'BINANCE:BTCUSDT',
  'ETH':    'BINANCE:ETHUSDT',
  'SOL':    'BINANCE:SOLUSDT',
  'BNB':    'BINANCE:BNBUSDT',
  'XRP':    'BINANCE:XRPUSDT',
  'S&P':    'FOREXCOM:SPXUSD',
  'SPX':    'FOREXCOM:SPXUSD',
  'SP500':  'FOREXCOM:SPXUSD',
  'NVDA':   'NASDAQ:NVDA',
  'NVDIA':  'NASDAQ:NVDA',
  'AAPL':   'NASDAQ:AAPL',
  'APPL':   'NASDAQ:AAPL',
  'QQQ':    'NASDAQ:QQQ',
  'GOLD':   'TVC:GOLD',
  'SILVER': 'TVC:SILVER',
  'SPCX':   'NASDAQ:SPCX',
  'HUT':    'NASDAQ:HUT',
  'HUT8':   'NASDAQ:HUT',
  'BTCUSDT':'BINANCE:BTCUSDT',
};

function toTVSymbol(sym) {
  const upper = (sym || 'BTC').toUpperCase();
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
  if (CRYPTO_SET.has(upper)) return `BINANCE:${upper}USDT`;
  return `NASDAQ:${upper}`;
}

function buildURL(symbol) {
  const tvSym = toTVSymbol(symbol);
  return (
    'https://s.tradingview.com/embed-widget/mini-symbol-overview/?' +
    'symbol=' + encodeURIComponent(tvSym) +
    '&locale=he_IL' +
    '&dateRange=1D' +
    '&colorTheme=dark' +
    '&trendLineColor=%234ade80' +
    '&underLineColor=rgba(26%2C10%2C46%2C0.8)' +
    '&underLineBottomColor=rgba(0%2C0%2C0%2C0)' +
    '&isTransparent=true' +
    '&noTimeScale=false' +
    '&width=100%25' +
    '&height=100%25'
  );
}

export default function MiniChartPanel({ navigate, symbol = 'BTC' }) {
  const [loaded, setLoaded] = useState(false);
  const [url,    setUrl]    = useState(() => buildURL(symbol));

  /* Reload iframe when symbol changes */
  useEffect(() => {
    setLoaded(false);
    setUrl(buildURL(symbol));
  }, [symbol]);

  return (
    <div className="mcp-wrap" role="button" tabIndex={0}
      onClick={() => navigate('charts')}
      onKeyDown={(e) => e.key === 'Enter' && navigate('charts')}
      aria-label={`פתח גרף ${symbol} מלא`}
    >
      {/* TradingView iframe — pointer-events disabled so overlay captures click */}
      <iframe
        key={url}
        src={url}
        title={`${symbol} mini chart`}
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

      {/* Transparent click overlay */}
      <div className="mcp-overlay">
        <span className="mcp-hint">📊 {symbol} — לחץ לגרף מלא</span>
      </div>
    </div>
  );
}
