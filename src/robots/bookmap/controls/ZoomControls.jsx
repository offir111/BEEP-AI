/**
 * ZoomControls — Nanosecond Zoom on the price axis. The slider tightens the
 * vertical price window (± fraction of mid). At maximum zoom the window is a few
 * ticks wide, so every individual liquidity/price update is visible — not an
 * average. Changing zoom re-centres the heatmap window.
 */
const STEPS = [
  { label: '±2%',    v: 0.02 },
  { label: '±1%',    v: 0.01 },
  { label: '±0.5%',  v: 0.005 },
  { label: '±0.2%',  v: 0.002 },
  { label: '±0.05%', v: 0.0005 },   // tick-level "nanosecond" zoom
];

export default function ZoomControls({ halfSpanPct, onChange }) {
  const idx = STEPS.reduce((best, s, i) =>
    Math.abs(s.v - halfSpanPct) < Math.abs(STEPS[best].v - halfSpanPct) ? i : best, 0);

  return (
    <div className="bm-zoom">
      <span className="bm-zoom-label">🔬 זום</span>
      <input
        type="range" min="0" max={STEPS.length - 1} step="1" value={idx}
        onChange={e => onChange(STEPS[+e.target.value].v)}
        className="bm-zoom-slider"
        aria-label="זום ציר מחיר"
      />
      <span className="bm-zoom-val">{STEPS[idx].label}</span>
    </div>
  );
}
