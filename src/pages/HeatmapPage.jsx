import { useState } from 'react';
import TvWidget from '../components/TvWidget';
import './HeatmapPage.css';

const STOCK_CFG = {
  exchanges: [], dataSource: 'SPX500', grouping: 'sector',
  blockSize: 'market_cap_basic', blockColor: 'change', locale: 'en',
  symbolUrl: '', colorTheme: 'dark', hasTopBar: true,
  isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true,
  isMonoSize: false, width: '100%', height: '100%',
};

const CRYPTO_CFG = {
  dataSource: 'Crypto', blockSize: 'market_cap_calc', blockColor: 'change',
  locale: 'en', colorTheme: 'dark', width: '100%', height: '100%', hasTopBar: true,
};

export default function HeatmapPage() {
  const [mode, setMode] = useState('stocks'); // 'stocks' | 'crypto'

  return (
    <div className="hmp-wrap" dir="rtl">
      <div className="hmp-toggle">
        <button
          className={`hmp-tab${mode === 'stocks' ? ' hmp-tab--on' : ''}`}
          onClick={() => setMode('stocks')}
        >מניות</button>
        <button
          className={`hmp-tab${mode === 'crypto' ? ' hmp-tab--on' : ''}`}
          onClick={() => setMode('crypto')}
        >קריפטו</button>
      </div>

      <div className="hmp-body">
        {mode === 'stocks'
          ? <TvWidget key="stocks"
              src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
              config={STOCK_CFG} />
          : <TvWidget key="crypto"
              src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js"
              config={CRYPTO_CFG} />
        }
      </div>
    </div>
  );
}
