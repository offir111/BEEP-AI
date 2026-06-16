/**
 * FngIndicator — Fear & Greed split button (crypto | stock) + gauge modal.
 * Gauge + modal copied from BEEP BEEP (NavBar.jsx FngGauge/FngModal).
 */
import { useState, useEffect } from 'react';
import './FngIndicator.css';

const fngColor = (v) =>
  v == null ? '#888' :
  v <= 20 ? '#c62828' :
  v <= 40 ? '#ef5350' :
  v <= 55 ? '#D4AF37' :
  v <= 75 ? '#66bb6a' : '#26a69a';

const fngLabel = (v) =>
  v <= 20 ? 'Extreme Fear' :
  v <= 40 ? 'Fear' :
  v <= 55 ? 'Neutral' :
  v <= 75 ? 'Greed' : 'Extreme Greed';

function FngGauge({ value, size = 160 }) {
  const cx = size / 2;
  const cy = Math.round(size * 0.60);
  const outR = Math.round(size * 0.43);
  const inR = Math.round(size * 0.29);
  const safe = value ?? 50;
  const toRad = (v) => ((180 - (v / 100) * 180) * Math.PI) / 180;
  const segment = (fromV, toV, color) => {
    const a1 = toRad(fromV), a2 = toRad(toV);
    const ox1 = cx + outR * Math.cos(a1), oy1 = cy - outR * Math.sin(a1);
    const ox2 = cx + outR * Math.cos(a2), oy2 = cy - outR * Math.sin(a2);
    const ix1 = cx + inR * Math.cos(a1), iy1 = cy - inR * Math.sin(a1);
    const ix2 = cx + inR * Math.cos(a2), iy2 = cy - inR * Math.sin(a2);
    const f = [ox1,oy1,ox2,oy2,ix1,iy1,ix2,iy2].map(n => n.toFixed(1));
    return (
      <path key={fromV}
        d={`M${f[0]} ${f[1]} A${outR} ${outR} 0 0 1 ${f[2]} ${f[3]} L${f[6]} ${f[7]} A${inR} ${inR} 0 0 0 ${f[4]} ${f[5]} Z`}
        fill={color} />
    );
  };
  const nAngle = toRad(safe);
  const needleL = outR - 3;
  const nx = (cx + needleL * Math.cos(nAngle)).toFixed(1);
  const ny = (cy - needleL * Math.sin(nAngle)).toFixed(1);
  const svgH = cy + 18;
  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} style={{ display:'block', margin:'0 auto' }}>
      {segment(0, 25, '#c62828')}
      {segment(25, 45, '#ef5350')}
      {segment(45, 55, '#D4AF37')}
      {segment(55, 75, '#66bb6a')}
      {segment(75, 100, '#26a69a')}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#ef5350" />
    </svg>
  );
}

function FngModal({ cryptoSeries, stockVal, stockLbl, onClose }) {
  const [tab, setTab] = useState('crypto');
  const cryptoNow = cryptoSeries?.[0];
  const cryptoVal = parseInt(cryptoNow?.value);
  const cryptoLbl = cryptoNow?.value_classification || fngLabel(cryptoVal);
  const dispVal = tab === 'crypto' ? cryptoVal : stockVal;
  const dispLbl = tab === 'crypto' ? cryptoLbl : (stockVal ? stockLbl : '...');
  const color = fngColor(dispVal ?? 50);
  const history = cryptoSeries ? [...cryptoSeries].slice(0, 7).reverse() : [];

  return (
    <div className="nb-fng-overlay" onClick={onClose}>
      <div className="nb-fng-modal" onClick={e => e.stopPropagation()}>
        <div className="nb-fng-mhdr">
          <span className="nb-fng-mtitle">Fear &amp; Greed Index</span>
          <button className="nb-fng-mclose" onClick={onClose}>✕</button>
        </div>
        <div className="nb-fng-toggle">
          <button className={`nb-fng-tog${tab === 'crypto' ? ' nb-fng-tog--on' : ''}`} onClick={() => setTab('crypto')}>Crypto</button>
          <button className={`nb-fng-tog${tab === 'stocks' ? ' nb-fng-tog--on' : ''}`} onClick={() => setTab('stocks')}>Stock Market</button>
        </div>
        <div className="nb-fng-gauge-wrap">
          <FngGauge value={dispVal ?? 50} size={200} />
          <div className="nb-fng-mval" style={{ color }}>{dispVal ?? '—'}</div>
          <div className="nb-fng-mlbl" style={{ color }}>{dispLbl}</div>
        </div>
        {tab === 'stocks' && (
          <div className="nb-fng-note">
            {stockVal ? 'CNN Fear & Greed — מדד שוק המניות האמריקאי' : <span style={{ color:'#555' }}>טוען נתונים…</span>}
          </div>
        )}
        {tab === 'crypto' && history.length > 0 && (
          <div className="nb-fng-history">
            <div className="nb-fng-hist-ttl">7 ימים אחרונים</div>
            <div className="nb-fng-hist-row">
              {history.map((d, i) => {
                const v = parseInt(d.value);
                const c = fngColor(v);
                const day = new Date(d.timestamp * 1000).toLocaleDateString('he-IL', { weekday: 'short' });
                return (
                  <div key={i} className="nb-fng-hist-col">
                    <div className="nb-fng-hist-bwrap">
                      <div className="nb-fng-hist-bar" style={{ height: `${v}%`, background: c }} />
                    </div>
                    <span className="nb-fng-hist-v" style={{ color: c }}>{v}</span>
                    <span className="nb-fng-hist-d">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'crypto' && cryptoNow && (
          <div className="nb-fng-stats">
            <div className="nb-fng-stat"><span className="nb-fng-stat-k">מקור</span><span className="nb-fng-stat-v">alternative.me</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FngIndicator() {
  const [cryptoSeries, setCryptoSeries] = useState(null);
  const [cryptoVal, setCryptoVal] = useState(null);
  const [stockVal, setStockVal] = useState(null);
  const [stockLbl, setStockLbl] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=7')
      .then(r => r.json())
      .then(d => { const data = d?.data || []; setCryptoSeries(data); setCryptoVal(parseInt(data[0]?.value)); })
      .catch(() => {});
    fetch('/api/fng-stocks')
      .then(r => r.json())
      .then(d => { if (d?.score != null) { setStockVal(d.score); setStockLbl(d.rating || fngLabel(d.score)); } })
      .catch(() => {});
  }, []);

  return (
    <>
      <button className="hp-fng-btn" onClick={() => setOpen(true)} aria-label="Fear & Greed Index">
        <div className="hp-fng-split">
          <div className="hp-fng-half">
            <span className="hp-fng-half-val" style={{ color: fngColor(stockVal) }}>{stockVal ?? '…'}</span>
            <span className="hp-fng-half-lbl">STOCKS</span>
          </div>
          <div className="hp-fng-divider" />
          <div className="hp-fng-half">
            <span className="hp-fng-half-val" style={{ color: fngColor(cryptoVal) }}>{cryptoVal ?? '…'}</span>
            <span className="hp-fng-half-lbl">CRYPTO</span>
          </div>
        </div>
      </button>
      {open && <FngModal cryptoSeries={cryptoSeries} stockVal={stockVal} stockLbl={stockLbl} onClose={() => setOpen(false)} />}
    </>
  );
}
