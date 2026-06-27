/**
 * ViewModeTabs — the PRIMARY visualization-mode selector for BOOK MAP.
 * A always-visible Hebrew tab strip (not buried in a dropdown), so it stays
 * reachable on phones. Picks the dominant view; secondary layers can still be
 * toggled in the Heatmap (אינדיקטורים) menu.
 */
const MODES = [
  { key: 'heatmap', label: 'מפת חום', icon: '🌡️' },
  { key: 'candles', label: 'נרות',    icon: '🕯️' },
  { key: 'bubbles', label: 'בועות',   icon: '🫧' },
  { key: 'book',    label: 'מפת ספר', icon: '📖' },
];

export default function ViewModeTabs({ mode, onMode }) {
  return (
    <div className="bm-modes" role="tablist" aria-label="מצב תצוגה">
      {MODES.map(m => (
        <button
          key={m.key}
          role="tab"
          aria-selected={mode === m.key}
          className={`bm-mode ${mode === m.key ? 'bm-mode--on' : ''}`}
          onClick={() => onMode(m.key)}
        >
          <span aria-hidden="true">{m.icon}</span> {m.label}
        </button>
      ))}
    </div>
  );
}

// Layer preset per mode (dominant view + sensible stacked layers).
export const MODE_PRESETS = {
  heatmap: { heatmap: true,  candles: false, bubbles: true,  bbo: true,  icebergs: true, profile: true },
  candles: { heatmap: true,  candles: true,  bubbles: false, bbo: true,  icebergs: true, profile: true },
  bubbles: { heatmap: true,  candles: false, bubbles: true,  bbo: false, icebergs: false, profile: true },
  book:    { heatmap: true,  candles: false, bubbles: false, bbo: true,  icebergs: true, profile: true },
};
