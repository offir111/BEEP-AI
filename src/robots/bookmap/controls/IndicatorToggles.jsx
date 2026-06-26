/**
 * IndicatorToggles — independent on/off for each overlay (2.1–2.7).
 */
const ITEMS = [
  { key: 'heatmap',  label: '🌡️ Heatmap' },
  { key: 'bubbles',  label: '🫧 בועות' },
  { key: 'bbo',      label: '📏 BBO' },
  { key: 'icebergs', label: '🧊 Iceberg/Stop' },
];

export default function IndicatorToggles({ toggles, onToggle }) {
  return (
    <div className="bm-toggles">
      {ITEMS.map(it => (
        <button
          key={it.key}
          className={`bm-toggle ${toggles[it.key] ? 'bm-toggle--on' : ''}`}
          onClick={() => onToggle(it.key)}
          aria-pressed={toggles[it.key]}
        >{it.label}</button>
      ))}
    </div>
  );
}
