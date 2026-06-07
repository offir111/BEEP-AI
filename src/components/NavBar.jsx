import { useState, useRef, useEffect } from 'react';
import './NavBar.css';

const MAIN_PAGES = [
  { id: 'home',   icon: '🏠', label: 'בית'    },
  { id: 'charts', icon: '📈', label: 'גרפים'  },
  { id: 'crypto', icon: '₿',  label: 'קריפטו' },
  { id: 'news',   icon: '📰', label: 'חדשות'  },
];

const MORE_PAGES = [
  { id: 'model-w',   icon: '🤖', label: 'Model W'   },
  { id: 'model-bit', icon: '₿',  label: 'Model BIT' },
  { id: 'model-smc', icon: '📐', label: 'Model SMC' },
  { id: 'finviz',    icon: '🔍', label: 'FINVIZ'    },
  { id: 'etoro',     icon: '📊', label: 'eToro'     },
  { id: 'twitter',   icon: '📡', label: 'Feed'      },
  { id: 'daily',     icon: '🤖', label: 'Daily AI'  },
];

export default function NavBar({ page, navigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const moreActive = MORE_PAGES.some(p => p.id === page);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav className="navbar navbar--top">
        {MAIN_PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'nav-item--on' : ''}`}
            onClick={() => navigate(p.id)}
          >
            <span className="nav-icon">{p.icon}</span>
            <span className="nav-label">{p.label}</span>
          </button>
        ))}

        {/* More dropdown */}
        <div className="nav-more-wrap" ref={menuRef}>
          <button
            className={`nav-item nav-more-btn ${moreActive ? 'nav-item--on' : ''} ${open ? 'nav-more-btn--open' : ''}`}
            onClick={() => setOpen(v => !v)}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">רובוטים ▾</span>
          </button>

          {open && (
            <div className="nav-dropdown">
              <div className="nav-dropdown-title">כלי מסחר</div>
              {MORE_PAGES.map(p => (
                <button
                  key={p.id}
                  className={`nav-dropdown-item ${page === p.id ? 'nav-dropdown-item--on' : ''}`}
                  onClick={() => { navigate(p.id); setOpen(false); }}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav className="navbar navbar--bottom">
        {MAIN_PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item-mobile ${page === p.id ? 'nav-item-mobile--on' : ''}`}
            onClick={() => navigate(p.id)}
          >
            <span className="nav-icon-mobile">{p.icon}</span>
            <span className="nav-label-mobile">{p.label}</span>
          </button>
        ))}
        <button
          className={`nav-item-mobile ${page === 'alerts' ? 'nav-item-mobile--on' : ''}`}
          onClick={() => navigate('alerts')}
        >
          <span className="nav-icon-mobile">🔔</span>
          <span className="nav-label-mobile">התראות</span>
        </button>
      </nav>
    </>
  );
}
