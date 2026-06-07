import { useState } from 'react';
import './TwitterPage.css';

const WHALE_ALERTS = [
  {
    id: 1,
    coin: '₿',
    coinColor: '#F7931A',
    coinBg: 'rgba(247,147,26,0.15)',
    amount: '24,869 BTC',
    usd: '$2.01B',
    dir: '→',
    dirLabel: 'נע לארנק קר',
    from: 'Strategy',
    type: 'move',
    color: '#4ade80',
  },
  {
    id: 2,
    coin: 'Ξ',
    coinColor: '#627EEA',
    coinBg: 'rgba(98,126,234,0.15)',
    amount: '71,672 ETH',
    usd: '$148M',
    dir: '↓',
    dirLabel: 'יצא מ-Coinbase',
    from: 'Coinbase',
    type: 'exit',
    color: '#4ade80',
  },
  {
    id: 3,
    coin: '₮',
    coinColor: '#26A17B',
    coinBg: 'rgba(38,161,123,0.15)',
    amount: '$1.2B USDT',
    usd: '$1.2B',
    dir: '🖨',
    dirLabel: 'הדפסת Tether',
    from: 'Tether',
    type: 'mint',
    color: '#D4AF37',
  },
];

const POSTS = [
  {
    id: 1,
    name: 'Michael Saylor',
    handle: '@saylor',
    avatar: 'S',
    avatarBg: '#1d4ed8',
    verified: true,
    time: '2h',
    text: 'Strategy holds 843,738 $BTC. The math is simple: Bitcoin is the most secure monetary network in human history. Accumulate accordingly. 🟠',
    sentiment: 'bullish',
    stat: '12.4K retweets',
    filter: 'BTC',
  },
  {
    id: 2,
    name: 'Watcher.Guru',
    handle: '@WatcherGuru',
    avatar: 'W',
    avatarBg: '#7c3aed',
    verified: true,
    time: '3h',
    text: '🚨 BREAKING: Analyst sets $AMZN price target at $370, implying +28% upside from current levels. AWS growth acceleration cited as key catalyst.',
    sentiment: 'bullish',
    stat: '3.2K likes',
    filter: 'מניות',
  },
  {
    id: 3,
    name: 'CoinTelegraph',
    handle: '@Cointelegraph',
    avatar: 'C',
    avatarBg: '#0ea5e9',
    verified: true,
    time: '4h',
    text: '⚡ Bitmine Immersion Technologies acquires 71,000 $ETH worth $148M. Now holds 106,000 ETH total. Becoming one of the largest institutional ETH holders.',
    sentiment: 'bullish',
    stat: '5.8K likes',
    filter: 'קריפטו',
  },
  {
    id: 4,
    name: 'Anthony Pompliano',
    handle: '@APompliano',
    avatar: 'A',
    avatarBg: '#059669',
    verified: true,
    time: '6h',
    text: 'Only 4 things have historically survived every market cycle: Bitcoin, Gold, real estate, and equities of productive companies. Everything else is speculation.',
    sentiment: 'neutral',
    stat: '9.1K likes',
    filter: 'קריפטו',
  },
  {
    id: 5,
    name: 'Scott Melker',
    handle: '@scottmelker',
    avatar: 'SM',
    avatarBg: '#b45309',
    verified: false,
    time: '8h',
    text: '$BTC is sitting at key support at $76K. This level has been tested 3 times. A break below sends us to $68K. Hold this and we target $98K next.',
    sentiment: 'neutral',
    stat: '2.7K likes',
    filter: 'BTC',
  },
  {
    id: 6,
    name: '🔴 BREAKING',
    handle: '@BREAKING_News',
    avatar: '!',
    avatarBg: '#dc2626',
    verified: false,
    time: '1h',
    text: '🔴 JUST IN: Federal Reserve holds interest rates unchanged at 4.25–4.50%. Chair Powell: "We need more confidence inflation is moving toward 2%." Markets mixed.',
    sentiment: 'neutral',
    stat: '44K impressions',
    filter: 'BREAKING',
  },
];

const FILTERS = ['הכל', 'BTC', 'מניות', 'קריפטו', 'BREAKING'];

const SENTIMENT_MAP = {
  bullish: { label: '🟢 Bullish', cls: 'tw-bull' },
  bearish: { label: '🔴 Bearish', cls: 'tw-bear' },
  neutral: { label: '🟡 Neutral', cls: 'tw-neut' },
};

export default function TwitterPage() {
  const [filter, setFilter] = useState('הכל');

  const posts = filter === 'הכל'
    ? POSTS
    : POSTS.filter(p => p.filter === filter);

  return (
    <div className="tw-wrap">

      {/* Header */}
      <div className="tw-header">
        <div>
          <h2 className="tw-title">📡 Market Feed — חדשות ופיד</h2>
          <p className="tw-sub">טוויטים נבחרים ממשפיענים — BTC, מניות, קריפטו</p>
        </div>
      </div>

      {/* Whale alerts */}
      <div className="tw-whale-section">
        <div className="tw-whale-title">🐋 Whale Alerts</div>
        <div className="tw-whale-scroll">
          {WHALE_ALERTS.map(w => (
            <div key={w.id} className="tw-whale-card">
              <div className="tw-whale-icon" style={{ background: w.coinBg, color: w.coinColor }}>
                {w.coin}
              </div>
              <div className="tw-whale-body">
                <div className="tw-whale-amount" style={{ color: w.color }}>{w.amount}</div>
                <div className="tw-whale-usd">{w.usd}</div>
                <div className="tw-whale-dir">{w.dirLabel}</div>
              </div>
              <div className="tw-whale-arrow" style={{ color: w.color }}>{w.dir}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter buttons */}
      <div className="tw-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`tw-filter-btn${filter === f ? ' tw-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span className="tw-post-count">{posts.length} פוסטים</span>
      </div>

      {/* Feed */}
      <div className="tw-feed">
        {posts.map(p => {
          const s = SENTIMENT_MAP[p.sentiment];
          return (
            <div key={p.id} className="tw-post">
              <div className="tw-post-avatar" style={{ background: p.avatarBg }}>
                {p.avatar}
              </div>
              <div className="tw-post-body">
                <div className="tw-post-top">
                  <div className="tw-post-name-row">
                    <span className="tw-post-name">{p.name}</span>
                    {p.verified && <span className="tw-verified">✓</span>}
                    <span className="tw-post-handle">{p.handle}</span>
                    <span className="tw-post-time">· {p.time}</span>
                  </div>
                  <span className={`tw-sentiment ${s.cls}`}>{s.label}</span>
                </div>
                <p className="tw-post-text">{p.text}</p>
                <div className="tw-post-footer">
                  <span className="tw-post-stat">{p.stat}</span>
                  <span className={`tw-post-filter-tag`}>{p.filter}</span>
                </div>
              </div>
            </div>
          );
        })}

        {posts.length === 0 && (
          <div className="tw-empty">אין פוסטים בקטגוריה זו</div>
        )}
      </div>

    </div>
  );
}
