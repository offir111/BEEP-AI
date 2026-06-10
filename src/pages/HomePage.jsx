import { useState, useEffect, useCallback, useRef } from 'react';
import { useAlerts } from '../context/AlertsContext';
import './HomePage.css';

// ── Live BTC ticker ────────────────────────────────────────────
function useBTC() {
  const [btc, setBtc] = useState(null);
  const [btcError, setBtcError] = useState(false);
  const [flash, setFlash] = useState(null);
  const prevRef = useRef(null);

  const fetch_ = useCallback(() => {
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        const price  = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChangePercent);
        const high   = parseFloat(d.highPrice);
        const low    = parseFloat(d.lowPrice);
        if (prevRef.current !== null) {
          if (price > prevRef.current) setFlash('up');
          else if (price < prevRef.current) setFlash('down');
          setTimeout(() => setFlash(null), 600);
        }
        prevRef.current = price;
        setBtcError(false);
        setBtc({ price, change, high, low });
      })
      .catch(() => setBtcError(true));
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, 15000);
    return () => clearInterval(iv);
  }, [fetch_]);

  return { btc, btcError, flash };
}

// ── Small market pill ─────────────────────────────────────────
function MarketPill({ symbol, label, prefix = '$' }) {
  const [price,   setPrice]   = useState(null);
  const [change,  setChange]  = useState(null);
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFailed(true), 6000);
    fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        clearTimeout(timer);
        if (d.price) { setPrice(d.price); setChange(d.change); setFailed(false); }
        else setFailed(true);
      })
      .catch(() => { clearTimeout(timer); setFailed(true); });
    return () => clearTimeout(timer);
  }, [symbol]);

  const up = (change || 0) >= 0;
  return (
    <div className="hp-pill">
      <span className="hp-pill-label">{label}</span>
      {price
        ? <>
            <span className="hp-pill-price">{prefix}{price.toLocaleString('en', { maximumFractionDigits: price < 10 ? 2 : 0 })}</span>
            <span className="hp-pill-change" style={{ color: up ? '#4ade80' : '#f87171' }}>
              {up ? '▲' : '▼'}{Math.abs(change).toFixed(1)}%
            </span>
          </>
        : failed ? <span className="hp-pill-failed">—</span>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Fear & Greed mini ─────────────────────────────────────────
function FearGreedMini() {
  const [val, setVal] = useState(null);
  const [lbl, setLbl] = useState('');
  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setVal(parseInt(d?.data?.[0]?.value)); setLbl(d?.data?.[0]?.value_classification || ''); })
      .catch(() => {});
  }, []);
  const color = !val ? '#888' : val <= 25 ? '#ef4444' : val <= 45 ? '#f97316' : val <= 55 ? '#eab308' : val <= 75 ? '#84cc16' : '#22c55e';
  return (
    <div className="hp-pill">
      <span className="hp-pill-label">F&amp;G</span>
      {val
        ? <><span className="hp-pill-price" style={{ color }}>{val}</span><span className="hp-pill-change" style={{ color, fontSize: '0.62rem' }}>{lbl}</span></>
        : <span className="hp-pill-loading">…</span>
      }
    </div>
  );
}

// ── Robot card ────────────────────────────────────────────────
function RobotCard({ icon, name, desc, tag, tagColor, onClick }) {
  return (
    <button className="hp-robot-card" onClick={onClick}>
      <div className="hp-robot-top">
        <div className="hp-robot-icon">{icon}</div>
        <span className="hp-robot-tag" style={{ color: tagColor, borderColor: tagColor + '55', background: tagColor + '18' }}>
          {tag}
        </span>
      </div>
      <div className="hp-robot-info">
        <div className="hp-robot-name">{name}</div>
        <div className="hp-robot-desc">{desc}</div>
      </div>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function HomePage({ navigate }) {
  const { btc, btcError, flash } = useBTC();
  const { alerts } = useAlerts();
  const activeAlerts = alerts.filter(a => !a.triggered).length;
  const up = btc ? btc.change >= 0 : true;

  const fmt = (n) => n >= 1000 ? n.toLocaleString('en', { maximumFractionDigits: 0 }) : n.toFixed(2);

  return (
    <div className="hp-wrap" dir="rtl">

      {/* ── BTC Hero ── */}
      <div className={`hp-btc-hero${flash === 'up' ? ' hp-flash-up' : flash === 'down' ? ' hp-flash-down' : ''}`}>
        <div className="hp-btc-left">
          <div className="hp-btc-badge">
            <span className="hp-btc-dot" />
            LIVE
          </div>
          <div className="hp-btc-symbol">₿ Bitcoin</div>
          <div className="hp-btc-price">
            {btcError
            ? <span className="hp-btc-err">⚠ שגיאת חיבור</span>
            : btc ? `$${fmt(btc.price)}` : <span className="hp-btc-loading">טוען…</span>
          }
          </div>
          {btc && (
            <div className="hp-btc-change" style={{ color: up ? '#4ade80' : '#f87171' }}>
              {up ? '▲' : '▼'} {Math.abs(btc.change).toFixed(2)}% — 24H
            </div>
          )}
          {btc && (
            <div className="hp-btc-hl">
              <span style={{ color: '#4ade80' }}>H ${fmt(btc.high)}</span>
              <span style={{ color: '#f87171' }}>  L ${fmt(btc.low)}</span>
            </div>
          )}
        </div>
        <button className="hp-btc-chart-btn" onClick={() => navigate('charts')} aria-label="פתח גרף BTC">
          <span style={{ fontSize: '1.6rem' }}>📊</span>
          <span>גרף נרות</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>TradingView</span>
        </button>
      </div>

      {/* ── Market strip ── */}
      <div className="hp-market-strip">
        <MarketPill symbol="^GSPC"    label="S&P 500" />
        <MarketPill symbol="XAUUSD=X" label="זהב" />
        <MarketPill symbol="ETH-USD"  label="ETH" />
        <MarketPill symbol="SOL-USD"  label="SOL" />
        <FearGreedMini />
      </div>

      {/* ── 2 Feature cards ── */}
      <div className="hp-features">

        {/* Alert feature */}
        <button className="hp-feature-card hp-feature-alert" onClick={() => navigate('alerts')}>
          <div className="hp-feature-glow hp-feature-glow--alert" />
          <div className="hp-feature-icon">🔔</div>
          <div className="hp-feature-text">
            <div className="hp-feature-title">Push Alerts</div>
            <div className="hp-feature-sub">קבל התראה כשהמחיר מגיע ליעד — גם כשהאפליקציה סגורה</div>
          </div>
          {activeAlerts > 0
            ? <span className="hp-feature-badge hp-feature-badge--active">{activeAlerts} פעיל</span>
            : <span className="hp-feature-badge">+ הגדר</span>
          }
        </button>

        {/* SOT / BEEP AI feature */}
        <button className="hp-feature-card hp-feature-ai" onClick={() => navigate('sot')}>
          <div className="hp-feature-glow hp-feature-glow--ai" />
          <div className="hp-feature-icon">🤖</div>
          <div className="hp-feature-text">
            <div className="hp-feature-title">BEEP AI Scan</div>
            <div className="hp-feature-sub">סריקת AI מיידית — מגלה את המניות הכי חמות עכשיו</div>
          </div>
          <span className="hp-feature-badge hp-feature-badge--ai">הפעל</span>
        </button>

      </div>

      {/* ── Robots section ── */}
      <div className="hp-section-title">🤖 סקנרים &amp; רובוטים</div>
      <div className="hp-robots">
        <RobotCard icon="🤖" name="SOT"        desc="סריקת AI יומית"          tag="AI"    tagColor="#818cf8" onClick={() => navigate('sot')} />
        <RobotCard icon="⚙️" name="Model W"    desc="קריפטו — BTC/ETH/SOL"   tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-w')} />
        <RobotCard icon="₿"  name="Model BIT"  desc="Bitcoin — 4H+1H"         tag="LIVE"  tagColor="#22d3ee" onClick={() => navigate('model-bit')} />
        <RobotCard icon="📐" name="Model SMC"  desc="Smart Money מוסדי"       tag="אנליזה" tagColor="#a78bfa" onClick={() => navigate('model-smc')} />
        <RobotCard icon="📊" name="FINVIZ"     desc="9 תבניות ריוורסל"        tag="סריקה" tagColor="#f59e0b" onClick={() => navigate('finviz')} />
        <RobotCard icon="📋" name="eToro"      desc="קופי טריידינג"            tag="Demo"  tagColor="#94a3b8" onClick={() => navigate('etoro')} />
        <RobotCard icon="📡" name="Feed"       desc="Whale Alerts + טוויטר"   tag="Demo"  tagColor="#94a3b8" onClick={() => navigate('twitter')} />
        <RobotCard icon="🗞️" name="Daily AI"   desc="חדשות מדורגות AI"         tag="אצור"  tagColor="#94a3b8" onClick={() => navigate('daily')} />
      </div>

      {/* ── Quick nav ── */}
      <div className="hp-section-title">⚡ גישה מהירה</div>
      <div className="hp-quick">
        <button className="hp-quick-btn" onClick={() => navigate('charts')}>📈<br/><small>גרפים</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('crypto')}>₿<br/><small>קריפטו</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('news')}>📰<br/><small>חדשות</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('daily')}>📅<br/><small>יומי</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('etoro')}>📋<br/><small>eToro</small></button>
        <button className="hp-quick-btn" onClick={() => navigate('twitter')}>🐦<br/><small>טוויטר</small></button>
      </div>

    </div>
  );
}
