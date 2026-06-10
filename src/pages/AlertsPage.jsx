/**
 * AlertsPage.jsx — Alerts dialog overlaid on a live chart, matching S.T.B behavior.
 *
 * Layout (matches BEEP BEEP):
 *   • TradingView chart fills the page background
 *   • Alert lines are drawn on the chart for the current symbol
 *   • QuickAlert dialog floats as an overlay (semi-transparent backdrop)
 *   • Closing the dialog reveals the chart with alert lines (issue 6)
 *   • Reopening shows the dialog again without navigating away
 */
import { useState, useEffect, useRef } from 'react';
import { useAlerts, fetchLivePrice } from '../context/AlertsContext';
import AlertLine          from '../components/AlertLine';
import QuickAlert         from '../components/QuickAlert';
import IframeWithFallback from '../components/IframeWithFallback';
import './AlertsPage.css';

// ── TradingView chart URL builder ──────────────────────────────
function buildTVUrl(tvSym, exchange) {
  return (
    `https://s.tradingview.com/widgetembed/?frameElementId=tv_alerts` +
    `&symbol=${encodeURIComponent(exchange + ':' + tvSym)}` +
    `&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1` +
    `&toolbarbg=12121a&theme=dark&style=1` +
    `&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`
  );
}

// ── Symbol → TradingView info ──────────────────────────────────
const SYM_TV = {
  BTC:  { tvSym: 'BTCUSD',  exchange: 'BINANCE' },
  ETH:  { tvSym: 'ETHUSD',  exchange: 'BINANCE' },
  SOL:  { tvSym: 'SOLUSD',  exchange: 'BINANCE' },
  XRP:  { tvSym: 'XRPUSD',  exchange: 'BINANCE' },
  BNB:  { tvSym: 'BNBUSD',  exchange: 'BINANCE' },
  DOGE: { tvSym: 'DOGEUSD', exchange: 'BINANCE' },
  ADA:  { tvSym: 'ADAUSD',  exchange: 'BINANCE' },
  AVAX: { tvSym: 'AVAXUSD', exchange: 'BINANCE' },
  GOLD: { tvSym: 'XAUUSD',  exchange: 'OANDA'   },
  AAPL: { tvSym: 'AAPL',    exchange: 'NASDAQ'  },
  NVDA: { tvSym: 'NVDA',    exchange: 'NASDAQ'  },
  TSLA: { tvSym: 'TSLA',    exchange: 'NASDAQ'  },
  SPY:  { tvSym: 'SPY',     exchange: 'AMEX'    },
  MSFT: { tvSym: 'MSFT',    exchange: 'NASDAQ'  },
  GOOGL:{ tvSym: 'GOOGL',   exchange: 'NASDAQ'  },
  AMZN: { tvSym: 'AMZN',    exchange: 'NASDAQ'  },
  BSOL: { tvSym: 'BSOLUSD', exchange: 'BINANCE' },
  KEEL: { tvSym: 'KEELBTC', exchange: 'BINANCE' },
  CIFR: { tvSym: 'CIFR',    exchange: 'NASDAQ'  },
  HUT:  { tvSym: 'HUT',     exchange: 'NASDAQ'  },
  MARA: { tvSym: 'MARA',    exchange: 'NASDAQ'  },
  RIOT: { tvSym: 'RIOT',    exchange: 'NASDAQ'  },
};

function getTV(sym) {
  return SYM_TV[sym.toUpperCase()] || { tvSym: sym, exchange: 'NASDAQ' };
}

export default function AlertsPage() {
  const { alerts, markSeen, editAlert, removeAlert } = useAlerts();

  // Currently displayed chart symbol (drives both chart and QuickAlert)
  const [chartSymbol, setChartSymbol] = useState('BTC');
  const [livePrice,   setLivePrice]   = useState(null);
  const [showDialog,  setShowDialog]  = useState(true);

  const containerRef = useRef(null);
  const [containerH,  setContainerH]  = useState(480);

  // Mark all fired alerts as seen on page open
  useEffect(() => { markSeen(); }, [markSeen]);

  // Measure chart area height for alert-line positioning
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerH(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fetch live price whenever the chart symbol changes
  useEffect(() => {
    setLivePrice(null);
    let cancelled = false;
    fetchLivePrice(chartSymbol)
      .then(p => { if (!cancelled && p) setLivePrice(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chartSymbol]);

  const tvInfo    = getTV(chartSymbol);
  const tvSrc     = buildTVUrl(tvInfo.tvSym, tvInfo.exchange);
  const symAlerts = alerts.filter(a => !a.triggered && a.symbol === chartSymbol.toUpperCase());

  return (
    <div className="ap-root">

      {/* ── Chart — fills the whole page behind everything ── */}
      <div className="ap-chart" ref={containerRef}>
        <IframeWithFallback
          iframeKey={`ap-chart-${chartSymbol}`}
          src={tvSrc}
          title={`גרף ${chartSymbol}`}
          className="ap-iframe"
        />

        {/* Alert price lines drawn over the chart */}
        {livePrice && symAlerts.length > 0 && (
          <div className="ap-lines">
            {symAlerts.map(a => (
              <AlertLine
                key={a.id}
                alert={a}
                containerH={containerH}
                currentPrice={livePrice}
                onPriceChange={(id, price) => editAlert(id, { target: price })}
                onRemove={removeAlert}
              />
            ))}
          </div>
        )}

        {/* Reopen button — shown after dialog is closed (issue 6) */}
        {!showDialog && (
          <button className="ap-reopen" onClick={() => setShowDialog(true)}>
            🔔 פתח התראות
            {symAlerts.length > 0 && (
              <span className="ap-reopen-badge">{symAlerts.length}</span>
            )}
          </button>
        )}
      </div>

      {/* ── Alerts dialog — overlaid on the chart (issues 1,2,4,5) ── */}
      {showDialog && (
        <QuickAlert
          symbol={chartSymbol}
          currentPrice={livePrice}
          onClose={() => setShowDialog(false)}
          onSymbolChange={setChartSymbol}
        />
      )}
    </div>
  );
}
