import IframeWithFallback from '../components/IframeWithFallback';
import './NewsPage.css';

const NEWS_SRC = 'https://s.tradingview.com/embed-widget/timeline/?locale=he_IL#%7B%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Afalse%2C%22displayMode%22%3A%22adaptive%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A600%2C%22utm_source%22%3A%22localhost%22%2C%22utm_medium%22%3A%22widget%22%2C%22utm_campaign%22%3A%22timeline%22%7D';

export default function NewsPage() {
  return (
    <div className="news-wrap">
      <h2 className="news-title">📰 חדשות שוק</h2>
      <div className="news-widget">
        <IframeWithFallback
          src={NEWS_SRC}
          title="Market News — TradingView"
          className="news-iframe"
          style={{ height: '600px' }}
        />
      </div>
    </div>
  );
}
