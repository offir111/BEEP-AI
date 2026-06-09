import { useState, useRef, useEffect } from 'react';
import './NavBar.css';

// BUG-01: Alerts added to main pages (desktop + mobile)
// BUG-01: Mobile "More" drawer added for all secondary tools
const MAIN_PAGES = [
  { id: 'home',   icon: '🏠', label: 'בית'    },
  { id: 'charts', icon: '📈', label: 'גרפים'  },
  { id: 'crypto', icon: '₿',  label: 'קריפטו' },
  { id: 'news',   icon: '📰', label: 'חדשות'  },
  { id: 'alerts', icon: '🔔', label: 'התראות' },
];

const MORE_PAGES = [
  { id: 'sot',       icon: '🤖', label: 'SOT'       },
  { id: 'model-w',   icon: '⚙️', label: 'Model W'   },
  { id: 'model-bit', icon: '₿',  label: 'Model BIT' },
  { id: 'model-smc', icon: '📐', label: 'Model SMC' },
  { id: 'finviz',    icon: '🔍', label: 'FINVIZ'    },
  { id: 'etoro',     icon: '📊', label: 'eToro'     },
  { id: 'twitter',   icon: '📡', label: 'Feed'      },
  { id: 'daily',     icon: '🤖', label: 'Daily AI'  },
];

export default function NavBar({ page, navigate }) {
  const [open,       setOpen]       = useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const menuRef     = useRef(null);
  const drawerRef   = useRef(null);

  const moreActive = MORE_PAGES.some(p => p.id === page);

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close mobile drawer on outside click
  useEffect(() => {
    if (!mobileMore) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setMobileMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMore]);

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav className="navbar navbar--top" role="navigation" aria-label="ניווט ראשי">
        {MAIN_PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'nav-item--on' : ''}`}
            onClick={() => navigate(p.id)}
            aria-label={p.label}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{p.icon}</span>
            <span className="nav-label">{p.label}</span>
          </button>
        ))}

        {/* More dropdown */}
        <div className="nav-more-wrap" ref={menuRef}>
          <button
            className={`nav-item nav-more-btn ${moreActive ? 'nav-item--on' : ''} ${open ? 'nav-more-btn--open' : ''}`}
            onClick={() => setOpen(v => !v)}
            aria-label="כלי מסחר נוספים"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <span className="nav-icon" aria-hidden="true">⚙️</span>
            <span className="nav-label">רובוטים ▾</span>
          </button>

          {open && (
            <div className="nav-dropdown" role="menu">
              <div className="nav-dropdown-title">כלי מסחר</div>
              {MORE_PAGES.map(p => (
                <button
                  key={p.id}
                  className={`nav-dropdown-item ${page === p.id ? 'nav-dropdown-item--on' : ''}`}
                  onClick={() => { navigate(p.id); setOpen(false); }}
                  role="menuitem"
                  aria-label={p.label}
                  aria-current={page === p.id ? 'true' : undefined}
                >
                  <span aria-hidden="true">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav className="navbar navbar--bottom" role="navigation" aria-label="ניווט מובייל">
        {MAIN_PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item-mobile ${page === p.id ? 'nav-item-mobile--on' : ''}`}
            onClick={() => navigate(p.id)}
            aria-label={p.label}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <span className="nav-icon-mobile" aria-hidden="true">{p.icon}</span>
            <span className="nav-label-mobile">{p.label}</span>
          </button>
        ))}

        {/* Mobile "More" button */}
        <button
          className={`nav-item-mobile ${moreActive ? 'nav-item-mobile--on' : ''}`}
          onClick={() => setMobileMore(v => !v)}
          aria-label="עוד כלי מסחר"
          aria-expanded={mobileMore}
          aria-haspopup="true"
        >
          <span className="nav-icon-mobile" aria-hidden="true">⋮</span>
          <span className="nav-label-mobile">עוד</span>
        </button>
      </nav>

      {/* ── Mobile drawer (BUG-01) ── */}
      {mobileMore && (
        <>
          <div
            className="nav-mobile-overlay"
            onClick={() => setMobileMore(false)}
            aria-hidden="true"
          />
          <div
            className="nav-mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-label="תפריט כלי מסחר"
          >
            <div className="nav-drawer-header">
              <span className="nav-drawer-title">כלי מסחר</span>
              <button
                className="nav-drawer-close"
                onClick={() => setMobileMore(false)}
                aria-label="סגור תפריט"
              >✕</button>
            </div>
            <div className="nav-drawer-grid">
              {MORE_PAGES.map(p => (
                <button
                  key={p.id}
                  className={`nav-drawer-item ${page === p.id ? 'nav-drawer-item--on' : ''}`}
                  onClick={() => { navigate(p.id); setMobileMore(false); }}
                  aria-label={p.label}
                  aria-current={page === p.id ? 'page' : undefined}
                >
                  <span className="nav-drawer-icon" aria-hidden="true">{p.icon}</span>
                  <span className="nav-drawer-label">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
