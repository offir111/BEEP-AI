/**
 * RobotNavTabs — shared quick navigation between all robot/scanner pages.
 * Styled in beep-ai dark theme (gold accent, no purple).
 * Place at the very top of every robot page.
 */
import './RobotNavTabs.css';

export const ROBOT_TABS = [
  { id: 'offir',      label: '➕ +OFFIR' },
  { id: 'tgm',        label: '🛰️ TGM'    },
  { id: 'sot',        label: '🤖 SOT'    },
  { id: 'model-w',    label: '⚙️ W'      },
  { id: 'model-bit',  label: '₿ BIT'     },
  { id: 'model-smc',  label: '📐 SMC'    },
  { id: 'model-grid', label: '📐 Grid'   },
  { id: 'finviz',     label: '🔍 FINVIZ' },
  { id: 'etoro',      label: '📊 eToro'  },
  { id: 'daily',      label: '🗞️ NEWS AI' },
];

export default function RobotNavTabs({ currentPage, navigate }) {
  return (
    <nav className="rnt-nav" aria-label="ניווט רובוטים">
      {ROBOT_TABS.map(t => {
        const active = t.id === currentPage;
        return (
          <button
            key={t.id}
            className={`rnt-tab${active ? ' rnt-tab--on' : ''}`}
            onClick={() => !active && navigate(t.id)}
            aria-current={active ? 'page' : undefined}
            tabIndex={active ? -1 : 0}
          >
            {t.label}
            {!active && <span className="rnt-arrow" aria-hidden="true">↗</span>}
          </button>
        );
      })}
    </nav>
  );
}
