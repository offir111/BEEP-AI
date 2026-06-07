import { useState, useEffect, useRef } from 'react';
import { useAlerts } from '../context/AlertsContext';
import AlertLine   from '../components/AlertLine';
import QuickAlert  from '../components/QuickAlert';
import './ChartsPage.css';

const SYMBOLS = [
  { id:'BTCUSD',  label:'Bitcoin',   exchange:'BINANCE', binance:'BTCUSDT',  priceApi:'BTC'   },
  { id:'ETHUSD',  label:'Ethereum',  exchange:'BINANCE', binance:'ETHUSDT',  priceApi:'ETH'   },
  { id:'SOLUSD',  label:'Solana',    exchange:'BINANCE', binance:'SOLUSDT',  priceApi:'SOL'   },
  { id:'XAUUSD',  label:'Gold',      exchange:'OANDA',   binance:null,       priceApi:'GC=F'  },
  { id:'AAPL',    label:'Apple',     exchange:'NASDAQ',  binance:null,       priceApi:'AAPL'  },
  { id:'NVDA',    label:'NVIDIA',    exchange:'NASDAQ',  binance:null,       priceApi:'NVDA'  },
  { id:'TSLA',    label:'Tesla',     exchange:'NASDAQ',  binance:null,       priceApi:'TSLA'  },
  { id:'MSFT',    label:'Microsoft', exchange:'NASDAQ',  binance:null,       priceApi:'MSFT'  },
  { id:'AMZN',    label:'Amazon',    exchange:'NASDAQ',  binance:null,       priceApi:'AMZN'  },
  { id:'GOOGL',   label:'Google',    exchange:'NASDAQ',  binance:null,       priceApi:'GOOGL' },
  { id:'SPY',     label:'S&P 500',   exchange:'AMEX',    binance:null,       priceApi:'^GSPC' },
];

const INTERVALS = [
  {id:'1',label:'1m'},{id:'5',label:'5m'},{id:'15',label:'15m'},
  {id:'60',label:'1h'},{id:'240',label:'4h'},{id:'D',label:'1D'},{id:'W',label:'1W'},
];

function buildTVUrl(sym, exchange, interval) {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${exchange}%3A${sym}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

export default function ChartsPage() {
  const { alerts, editAlert, removeAlert } = useAlerts();
  const [active,    setActive]    = useState(SYMBOLS[0]);
  const [interval,  setInterval]  = useState('D');
  const [showAlert, setShowAlert] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const containerRef = useRef(null);
  const [containerH, setContainerH] = useState(480);

  // Measure container height for alert lines
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerH(entries[0].contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fetch live price for active symbol
  useEffect(() => {
    setLivePrice(null);
    const s = active;
    let cancelled = false;
    const fetch_ = async () => {
      try {
        let p = null;
        if (s.binance) {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s.binance}`);
          const d = await r.json();
          p = parseFloat(d.price);
        } else {
          const r = await fetch(`/api/market?symbol=${encodeURIComponent(s.priceApi)}`);
          const d = await r.json();
          p = d.price;
        }
        if (!cancelled && p) setLivePrice(p);
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [active]);

  // Active non-triggered alerts for current symbol
  const symAlerts = alerts.filter(a =>
    !a.triggered &&
    (a.symbol === active.label.toUpperCase() ||
     a.symbol === active.id.replace('USD','') ||
     a.symbol === active.priceApi.replace('^','').replace('=F',''))
  );

  return (
    <div className="charts-wrap">

      {/* Header */}
      <div className="charts-hdr">
        <div className="charts-hdr-left">
          <h2 className="charts-title">
            📈 {active.label}
            {livePrice && <span className="charts-live-price">${parseFloat(livePrice).toLocaleString()}</span>}
          </h2>
          {symAlerts.length > 0 && (
            <span className="charts-alert-count">🔔 {symAlerts.length}</span>
          )}
        </div>
        <div className="charts-hdr-right">
          <div className="charts-intervals">
            {INTERVALS.map(iv => (
              <button key={iv.id}
                className={`charts-iv-btn ${interval===iv.id?'charts-iv-btn--on':''}`}
                onClick={()=>setInterval(iv.id)}>{iv.label}</button>
            ))}
          </div>
          <button className="charts-alert-btn" onClick={()=>setShowAlert(true)}>
            🔔 <span>התראה</span>
          </button>
        </div>
      </div>

      {/* Chart + alert lines overlay */}
      <div className="charts-tv-wrap" ref={containerRef}>
        <iframe
          key={`${active.id}-${interval}`}
          src={buildTVUrl(active.id, active.exchange, interval)}
          className="charts-tv-iframe"
          title={`${active.label} chart`}
          allowFullScreen
        />

        {/* Alert lines overlay */}
        {livePrice && symAlerts.length > 0 && (
          <div className="charts-lines-overlay">
            {symAlerts.map(a => (
              <AlertLine
                key={a.id}
                alert={a}
                containerH={containerH}
                currentPrice={livePrice}
                onPriceChange={editAlert}
                onRemove={removeAlert}
              />
            ))}
          </div>
        )}

        {/* Floating bell */}
        <button className="charts-float-bell" onClick={()=>setShowAlert(true)}>
          🔔
          {symAlerts.length > 0 && <span className="charts-float-badge">{symAlerts.length}</span>}
          {livePrice && <span className="charts-float-price">${parseFloat(livePrice).toLocaleString()}</span>}
        </button>
      </div>

      {/* Symbol buttons */}
      <div className="charts-symbols">
        {SYMBOLS.map(s => (
          <button key={s.id}
            className={`charts-sym-btn ${active.id===s.id?'charts-sym-btn--on':''}`}
            onClick={()=>setActive(s)}>
            {s.label}
            {alerts.filter(a=>!a.triggered&&(a.symbol===s.label.toUpperCase()||a.symbol===s.id.replace('USD',''))).length > 0 && (
              <span className="charts-sym-badge">🔔</span>
            )}
          </button>
        ))}
      </div>

      {showAlert && (
        <QuickAlert
          symbol={active.label.toUpperCase()}
          currentPrice={livePrice}
          onClose={()=>setShowAlert(false)}
        />
      )}
    </div>
  );
}
