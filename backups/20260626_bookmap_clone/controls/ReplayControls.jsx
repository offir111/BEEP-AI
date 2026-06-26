/**
 * ReplayControls — play / pause / scrub / speed over recorded REAL ticks.
 * Pure UI; the parent drives the actual replay engine state.
 */
const SPEEDS = [0.5, 1, 2, 5, 10];

export default function ReplayControls({
  active, playing, progress, speed, total,
  onPlayPause, onScrub, onSpeed, onExit,
}) {
  if (!active) return null;
  return (
    <div className="bm-replay">
      <button className="bm-replay-btn" onClick={onPlayPause}>{playing ? '⏸️' : '⏵'}</button>
      <input
        type="range" min="0" max="1000" step="1"
        value={Math.round(progress * 1000)}
        onChange={e => onScrub(+e.target.value / 1000)}
        className="bm-replay-scrub"
        aria-label="מיקום בשחזור"
      />
      <div className="bm-replay-speed">
        {SPEEDS.map(s => (
          <button key={s} className={`bm-replay-sp ${s === speed ? 'on' : ''}`} onClick={() => onSpeed(s)}>{s}×</button>
        ))}
      </div>
      <span className="bm-replay-count">{total} ticks</span>
      <button className="bm-replay-exit" onClick={onExit}>✕ יציאה</button>
    </div>
  );
}
