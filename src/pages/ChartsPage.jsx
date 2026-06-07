import './ChartsPage.css';

const SYMBOLS = ['AAPL','MSFT','TSLA','NVDA','AMZN','GOOGL','META','BTC','ETH','XAUUSD'];

export default function ChartsPage() {
  return (
    <div className="charts-wrap">
      <h2 className="charts-title">📈 גרפים</h2>
      <div className="charts-tv">
        <iframe
          src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview&symbol=NASDAQ%3AAAPL&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1a1a26&theme=dark&style=1&timezone=Asia%2FJerusalem&withdateranges=1&hidevolume=0&locale=he_IL"
          style={{ width: '100%', height: '500px', border: 'none', borderRadius: '10px' }}
          title="TradingView Chart"
          allowFullScreen
        />
      </div>
      <div className="charts-symbols">
        {SYMBOLS.map(s => (
          <a
            key={s}
            href={`https://www.tradingview.com/chart/?symbol=${s}`}
            target="_blank"
            rel="noreferrer"
            className="charts-sym-btn"
          >{s}</a>
        ))}
      </div>
    </div>
  );
}
