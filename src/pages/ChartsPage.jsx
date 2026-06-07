import { useState } from 'react';
import './ChartsPage.css';

const SYMBOLS = [
  { id: 'AAPL',   label: 'Apple',   exchange: 'NASDAQ' },
  { id: 'MSFT',   label: 'Microsoft', exchange: 'NASDAQ' },
  { id: 'TSLA',   label: 'Tesla',   exchange: 'NASDAQ' },
  { id: 'NVDA',   label: 'NVIDIA',  exchange: 'NASDAQ' },
  { id: 'AMZN',   label: 'Amazon',  exchange: 'NASDAQ' },
  { id: 'GOOGL',  label: 'Google',  exchange: 'NASDAQ' },
  { id: 'META',   label: 'Meta',    exchange: 'NASDAQ' },
  { id: 'BTCUSD', label: 'Bitcoin', exchange: 'BINANCE' },
  { id: 'ETHUSD', label: 'Ethereum', exchange: 'BINANCE' },
  { id: 'XAUUSD', label: 'Gold',    exchange: 'OANDA' },
  { id: 'SPY',    label: 'S&P 500', exchange: 'AMEX' },
];

const INTERVALS = [
  { id: '1',  label: '1m'  },
  { id: '5',  label: '5m'  },
  { id: '15', label: '15m' },
  { id: '60', label: '1h'  },
  { id: '240',label: '4h'  },
  { id: 'D',  label: '1D'  },
  { id: 'W',  label: '1W'  },
];

function buildUrl(symbol, exchange, interval) {
  const full = `${exchange}%3A${symbol}`;
  return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${full}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=12121a&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&locale=he_IL`;
}

export default function ChartsPage() {
  const [active,   setActive]   = useState(SYMBOLS[7]); // Bitcoin default
  const [interval, setInterval] = useState('D');

  return (
    <div className="charts-wrap">

      {/* Header */}
      <div className="charts-hdr">
        <h2 className="charts-title">📈 גרפים</h2>
        <div className="charts-intervals">
          {INTERVALS.map(iv => (
            <button
              key={iv.id}
              className={`charts-iv-btn ${interval === iv.id ? 'charts-iv-btn--on' : ''}`}
              onClick={() => setInterval(iv.id)}
            >{iv.label}</button>
          ))}
        </div>
      </div>

      {/* TradingView iframe */}
      <div className="charts-tv">
        <iframe
          key={`${active.id}-${interval}`}
          src={buildUrl(active.id, active.exchange, interval)}
          style={{ width: '100%', height: '480px', border: 'none' }}
          title={`${active.label} chart`}
          allowFullScreen
        />
      </div>

      {/* Symbol buttons — click updates chart inside the page */}
      <div className="charts-symbols">
        {SYMBOLS.map(s => (
          <button
            key={s.id}
            className={`charts-sym-btn ${active.id === s.id ? 'charts-sym-btn--on' : ''}`}
            onClick={() => setActive(s)}
          >{s.label}</button>
        ))}
      </div>

    </div>
  );
}
