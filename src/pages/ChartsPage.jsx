import { useState, useEffect } from 'react';
import QuickAlert from '../components/QuickAlert';
import './ChartsPage.css';

const SYMBOLS = [
  { id: 'BTCUSD', label: 'Bitcoin',   exchange: 'BINANCE',  priceApi: 'BTC'     },
  { id: 'ETHUSD', label: 'Ethereum',  exchange: 'BINANCE',  priceApi: 'ETH'     },
  { id: 'SOLUSD', label: 'Solana',    exchange: 'BINANCE',  priceApi: 'SOL'     },
  { id: 'XAUUSD', label: 'Gold',      exchange: 'OANDA',    priceApi: 'GC=F'    },
  { id: 'AAPL',   label: 'Apple',     exchange: 'NASDAQ',   priceApi: 'AAPL'    },
  { id: 'MSFT',   label: 'Microsoft', exchange: 'NASDAQ',   priceApi: 'MSFT'    },
  { id: 'NVDA',   label: 'NVIDIA',    exchange: 'NASDAQ',   priceApi: 'NVDA'    },
  { id: 'TSLA',   label: 'Tesla',     exchange: 'NASDAQ',   priceApi: 'TSLA'    },
  { id: 'AMZN',   label: 'Amazon',    exchange: 'NASDAQ',   priceApi: 'AMZN'    },
  { id: 'GOOGL',  label: 'Google',    exchange: 'NASDAQ',   priceApi: 'GOOGL'   },
  { id: 'SPY',    label: 'S&P 500',   exchange: 'AMEX',     priceApi: '^GSPC'   },
];

const INTERVALS = [
  { id: '1',   label: '1m'  },
  { id: '5',   label: '5m'  },
  { id: '15',  label: '15m' },
  { id: '60',  label: '1h'  },
  { id: '240', label: '4h'  },
  { id: 'D',   label: '1D'  },
  { id: 'W',   label: '1W'  },
];

const CRYPTO_MAP = { BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT' };

function buildUrl(sym, exchange, interval) {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${exchange}%3A${sym}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

export default function ChartsPage() {
  const [active,      setActive]      = useState(SYMBOLS[0]);
  const [interval,    setInterval]    = useState('D');
  const [showAlert,   setShowAlert]   = useState(false);
  const [livePrice,   setLivePrice]   = useState(null);

  // Fetch live price for the active symbol
  useEffect(() => {
    setLivePrice(null);
    const sym = active.priceApi;
    const cryptoSym = CRYPTO_MAP[sym];

    if (cryptoSym) {
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cryptoSym}`)
        .then(r => r.json())
        .then(d => setLivePrice(parseFloat(d.price)))
        .catch(() => {});
    } else {
      fetch(`/api/market?symbol=${encodeURIComponent(sym)}`)
        .then(r => r.json())
        .then(d => d.price && setLivePrice(d.price))
        .catch(() => {});
    }
  }, [active]);

  return (
    <div className="charts-wrap">

      {/* Header */}
      <div className="charts-hdr">
        <div className="charts-hdr-left">
          <h2 className="charts-title">
            📈 {active.label}
            {livePrice && (
              <span className="charts-live-price">${livePrice.toLocaleString()}</span>
            )}
          </h2>
        </div>

        <div className="charts-hdr-right">
          {/* Intervals */}
          <div className="charts-intervals">
            {INTERVALS.map(iv => (
              <button
                key={iv.id}
                className={`charts-iv-btn ${interval === iv.id ? 'charts-iv-btn--on' : ''}`}
                onClick={() => setInterval(iv.id)}
              >{iv.label}</button>
            ))}
          </div>

          {/* 🔔 BELL BUTTON */}
          <button
            className="charts-alert-btn"
            onClick={() => setShowAlert(true)}
            title={`הוסף התראה על ${active.label}`}
          >
            🔔 <span>התראה</span>
          </button>
        </div>
      </div>

      {/* TradingView iframe */}
      <div className="charts-tv-wrap">
        <iframe
          key={`${active.id}-${interval}`}
          src={buildUrl(active.id, active.exchange, interval)}
          className="charts-tv-iframe"
          title={`${active.label} chart`}
          allowFullScreen
        />

        {/* Floating bell button on chart */}
        <button
          className="charts-float-bell"
          onClick={() => setShowAlert(true)}
          title={`התראה על ${active.label}`}
        >
          🔔
          {livePrice && <span className="charts-float-price">${livePrice.toLocaleString()}</span>}
        </button>
      </div>

      {/* Symbol buttons */}
      <div className="charts-symbols">
        {SYMBOLS.map(s => (
          <button
            key={s.id}
            className={`charts-sym-btn ${active.id === s.id ? 'charts-sym-btn--on' : ''}`}
            onClick={() => setActive(s)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Quick Alert Modal */}
      {showAlert && (
        <QuickAlert
          symbol={active.label.toUpperCase().replace(' ', '_')}
          currentPrice={livePrice}
          onClose={() => setShowAlert(false)}
        />
      )}

    </div>
  );
}
