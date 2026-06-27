/**
 * RobotMenu — the "BOOK MAP" dropdown in the top bar. Replaces the old robots
 * tab strip: lists every robot and navigates to it. The list is kept here (a
 * private copy) so we never edit the shared RobotNavTabs component.
 */
import { useState, useEffect, useRef } from 'react';

const ROBOTS = [
  { id: 'daily',      label: '🗞️ Daily'  },
  { id: 'etoro',      label: '📊 eToro'  },
  { id: 'finviz',     label: '🔍 FINVIZ' },
  { id: 'model-grid', label: '📐 Grid'   },
  { id: 'model-smc',  label: '📐 SMC'    },
  { id: 'model-bit',  label: '₿ BIT'     },
  { id: 'model-w',    label: '⚙️ W'      },
  { id: 'sot',        label: '🤖 SOT'    },
  { id: 'tgm',        label: '🛰️ TGM'    },
];

export default function RobotMenu({ navigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="bm-menu" ref={ref}>
      <button className={`bm-menu-btn bm-menu-btn--brand ${open ? 'on' : ''}`} onClick={() => setOpen(o => !o)}>
        🗺️ BOOK MAP <span className="bm-caret">▾</span>
      </button>
      {open && (
        <div className="bm-menu-pop">
          <div className="bm-menu-head">רובוטים</div>
          {ROBOTS.map(r => (
            <button key={r.id} className="bm-menu-item"
              onClick={() => { navigate(r.id); setOpen(false); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
