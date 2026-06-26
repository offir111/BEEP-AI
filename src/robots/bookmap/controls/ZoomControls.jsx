/**
 * ZoomControls — vertical zoom on the auto-ranging price axis. The slider scales
 * the visible band (zoom multiplier on the rolling min/max window): tighter →
 * candles & liquidity spread out for tick-level detail; wider → more context.
 */
const STEPS = [
  { label: 'צמוד', v: 0.4 },
  { label: '0.7×', v: 0.7 },
  { label: '1×',   v: 1 },
  { label: '1.6×', v: 1.6 },
  { label: 'רחב',  v: 2.6 },
];

export default function ZoomControls({ zoomMult, onChange }) {
  const idx = STEPS.reduce((best, s, i) =>
    Math.abs(s.v - zoomMult) < Math.abs(STEPS[best].v - zoomMult) ? i : best, 0);

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
