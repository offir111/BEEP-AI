import './NavBar.css';

const PAGES = [
  { id: 'home',   icon: '🏠', label: 'בית'     },
  { id: 'charts', icon: '📈', label: 'גרפים'   },
  { id: 'crypto', icon: '₿',  label: 'קריפטו'  },
  { id: 'news',   icon: '📰', label: 'חדשות'   },
];

export default function NavBar({ page, navigate }) {
  return (
    <nav className="navbar">
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
  );
}
