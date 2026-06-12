import { useState, useEffect, useContext } from 'react';
import IframeWithFallback from '../components/IframeWithFallback';
import RobotNavTabs from '../components/RobotNavTabs';
import './ModelSmcPage.css';
import LiveQuoteContext, { useQuote } from '../context/LiveQuoteContext';

const STOCKS = [
  { symbol: 'AAPL',  name: 'Apple',     sector: 'Tech'    },
  { symbol: 'MSFT',  name: 'Microsoft', sector: 'Tech'    },
  { symbol: 'NVDA',  name: 'Nvidia',    sector: 'Chips'   },
  { symbol: 'GOOGL', name: 'Alphabet',  sector: 'Tech'    },
  { symbol: 'AMZN',  name: 'Amazon',    sector: 'E-Comm'  },
  { symbol: 'META',  name: 'Meta',      sector: 'Social'  },
  { symbol: 'TSLA',  name: 'Tesla',     sector: 'EV'      },
  { symbol: 'JPM',   name: 'JPMorgan',  sector: 'Finance' },
];

function getSmcSignal(change) {
  if (change > 2)   return { label: 'BOS ↑',       cls: 'smc-bos-up',  desc: 'Break of Structure — עלייה' };
  if (change < -2)  return { label: 'BOS ↓',       cls: 'smc-bos-dn',  desc: 'Break of Structure — ירידה' };
  if (change > 0.5) return { label: 'Order Block', cls: 'smc-ob',      desc: 'בלוק ביקוש מוסדי' };
  if (change < -0.5)return { label: 'FVG',         cls: 'smc-fvg',     desc: 'Fair Value Gap' };
  return               { label: 'Order Block', cls: 'smc-ob',      desc: 'אזור ניטרלי — מתן' };
}

function StockCard({ stock, onSelect, selected }) {
  const lqCtx = useContext(LiveQuoteContext);
  const { price, change: changeRaw, flash } = useQuote(stock.symbol);

  useEffect(() => {
    if (!lqCtx) return;
    lqCtx.subscribe([stock.symbol]);
    return () => lqCtx.unsubscribe([stock.symbol]);
  }, [stock.symbol, lqCtx]);

  const data    = price != null ? { price, change: changeRaw ?? 0 } : null;
  const loading = price == null;
  const error   = false;

  const sig = data ? getSmcSignal(data.change) : null;
  const up  = data ? (data.change || 0) >= 0 : true;

  return (
    <div
      className={`smc-card${selected ? ' smc-card--active' : ''}`}
      onClick={() => onSelect(stock)}
    >
      <div className="smc-card-top">
        <div className="smc-symbol">{stock.symbol}</div>
        <div className="smc-sector-badge">{stock.sector}</div>
      </div>
      <div className="smc-name">{stock.name}</div>

      <div className="smc-card-mid">
        {loading ? (
          <div className="smc-skeleton" style={{ width: '70%', height: '22px' }} />
        ) : error ? (
          <div className="smc-err">⚠ טוען...</div>
        ) : (
          <>
            <div className={`smc-price${flash === 'up' ? ' lp-flash-up' : flash === 'down' ? ' lp-flash-down' : ''}`}>${data.price.toLocaleString()}</div>
            <div className="smc-change" style={{ color: up ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {up ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)}%
            </div>
          </>
        )}
      </div>

      {sig && (
        <div className={`smc-signal-tag ${sig.cls}`}>
          <span className="smc-sig-label">{sig.label}</span>
          <span className="smc-sig-desc">{sig.desc}</span>
        </div>
      )}
    </div>
  );
}

export default function ModelSmcPage({ navigate }) {
  const [selected, setSelected] = useState(STOCKS[0]);
  const [lastUpdate, setLastUpdate] = useState('');

  const refresh = () => {
    setLastUpdate(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
    }));
  };

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
    }));
  }, []);

  return (
    <div className="smc-wrap">

      <RobotNavTabs currentPage="model-smc" navigate={navigate} />

      {/* Header */}
      <div className="smc-header">
        <div>
          <h2 className="smc-title">📐 Model SMC — Smart Money</h2>
          <p className="smc-sub">מניות עם כסף מוסדי — AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, JPM</p>
        </div>
        <div className="smc-header-right">
          {lastUpdate && <span className="smc-last-update">עדכון: {lastUpdate}</span>}
          <button className="smc-refresh-btn" onClick={refresh}>↻ רענן</button>
        </div>
      </div>

      {/* Legend */}
      <div className="smc-legend">
        <span className="smc-legend-item smc-bos-up">BOS ↑ — פריצה מעלה</span>
        <span className="smc-legend-item smc-bos-dn">BOS ↓ — פריצה מטה</span>
        <span className="smc-legend-item smc-ob">Order Block — בלוק מוסדי</span>
        <span className="smc-legend-item smc-fvg">FVG — פער שוק הוגן</span>
      </div>

      {/* Grid */}
      <div className="smc-grid">
        {STOCKS.map(s => (
          <StockCard
            key={s.symbol}
            stock={s}
            selected={selected?.symbol === s.symbol}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* TradingView chart */}
      {selected && (
        <div className="smc-chart-wrap">
          <div className="smc-chart-title">
            גרף {selected.symbol} — {selected.name} — 1D
          </div>
          <div className="smc-chart-container">
            <IframeWithFallback
              iframeKey={selected.symbol}
              title={`גרף ${selected.symbol} יומי`}
              src={`https://s.tradingview.com/widgetembed/?symbol=NASDAQ:${selected.symbol}&interval=D&theme=dark&locale=he_IL&toolbarbg=12121a`}
              className="smc-chart-iframe"
            />
          </div>
        </div>
      )}

    </div>
  );
}
