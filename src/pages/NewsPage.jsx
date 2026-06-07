import './NewsPage.css';

export default function NewsPage() {
  return (
    <div className="news-wrap">
      <h2 className="news-title">📰 חדשות שוק</h2>
      <div className="news-widget">
        <iframe
          src="https://s.tradingview.com/embed-widget/timeline/?locale=he_IL#%7B%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Afalse%2C%22displayMode%22%3A%22adaptive%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A600%2C%22utm_source%22%3A%22localhost%22%2C%22utm_medium%22%3A%22widget%22%2C%22utm_campaign%22%3A%22timeline%22%7D"
          style={{ width: '100%', height: '600px', border: 'none', borderRadius: '10px' }}
          title="Market News"
          allowFullScreen
        />
      </div>
    </div>
  );
}
