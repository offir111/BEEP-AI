import './NavBar.css';

const PAGES = [
  { id: 'home',   icon: '🏠', label: 'בית'    },
  { id: 'charts', icon: '📈', label: 'גרפים'  },
  { id: 'crypto', icon: '₿',  label: 'קריפטו' },
  { id: 'news',   icon: '📰', label: 'חדשות'  },
];

export default function NavBar({ page, navigate }) {
  return (
    <>
      {/* Desktop top nav */}
      <nav className="navbar navbar--top">
        {PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'nav-item--on' : ''}`}
            onClick={() => navigate(p.id)}
          >
            <span className="nav-icon">{p.icon}</span>
            <span className="nav-label">{p.label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="navbar navbar--bottom">
        {PAGES.map(p => (
          <button
            key={p.id}
            className={`nav-item-mobile ${page === p.id ? 'nav-item-mobile--on' : ''}`}
            onClick={() => navigate(p.id)}
          >
            <span className="nav-icon-mobile">{p.icon}</span>
            <span className="nav-label-mobile">{p.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
