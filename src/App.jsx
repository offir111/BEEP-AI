import { useState, useEffect } from 'react';
import { AlertsProvider } from './context/AlertsContext';
import LoginScreen  from './components/LoginScreen';
import Header       from './components/Header';
import NavBar       from './components/NavBar';
import AlertBanner  from './components/AlertBanner';
import HomePage     from './pages/HomePage';
import ChartsPage   from './pages/ChartsPage';
import CryptoPage   from './pages/CryptoPage';
import NewsPage     from './pages/NewsPage';
import AlertsPage   from './pages/AlertsPage';
import ModelWPage   from './pages/ModelWPage';
import ModelBitPage from './pages/ModelBitPage';
import ModelSmcPage from './pages/ModelSmcPage';
import FinvizPage   from './pages/FinvizPage';
import EtoroPage    from './pages/EtoroPage';
import TwitterPage  from './pages/TwitterPage';
import DailyPage         from './pages/DailyPage';
import ScanOfTodayPage   from './pages/ScanOfTodayPage';
import NotFoundPage      from './pages/NotFoundPage';
import './App.css';

const VALID_PAGES = [
  'home','charts','crypto','news','alerts',
  'model-w','model-bit','model-smc',
  'finviz','etoro','twitter','daily','sot'
];

// UX-07: Offline detection banner
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);
  if (!offline) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#ef4444', color: '#fff', textAlign: 'center',
      padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }} role="alert" aria-live="assertive">
      ⚠️ אין חיבור לאינטרנט — הנתונים עשויים להיות לא מעודכנים
    </div>
  );
}

const PAGE_TITLES = {
  charts: '📈 גרפים', crypto: '₿ קריפטו', news: '📰 חדשות',
  alerts: '🔔 התראות', 'model-w': '🤖 Model W', 'model-bit': '₿ Model BIT',
  'model-smc': '📐 Model SMC', finviz: '📊 FINVIZ', etoro: '📋 eToro',
  twitter: '🐦 טוויטר', daily: '📅 יומי', sot: '🤖 SOT',
};

function PageTopBar({ page, onBack, onClose }) {
  if (page === 'home') return null;
  return (
    <div className="page-topbar">
      <button className="page-topbar-back" onClick={onBack} aria-label="חזור לעמוד הקודם">
        &#8592; חזור
      </button>
      <span className="page-topbar-title">{PAGE_TITLES[page] || ''}</span>
      <button className="page-topbar-close" onClick={onClose} aria-label="סגור ועבור לדף הבית">
        &#10005;
      </button>
    </div>
  );
}

function AppInner() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('beepai_session')); } catch { return null; }
  });
  const [page, setPage] = useState('home');
  const [navHistory, setNavHistory] = useState(['home']);

  const logout = () => {
    localStorage.removeItem('beepai_session');
    setSession(null);
  };

  // navigate: deep-link, adds to history (back button works)
  const navigate = (p) => {
    const target = VALID_PAGES.includes(p) ? p : '404';
    setPage(target);
    setNavHistory(prev => [...prev, target]);
    window.scrollTo(0, 0);
  };

  // navigatePrimary: top-level NavBar click — resets history stack
  const navigatePrimary = (p) => {
    const target = VALID_PAGES.includes(p) ? p : '404';
    setPage(target);
    setNavHistory(['home', target]);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (navHistory.length > 1) {
      const prev = navHistory[navHistory.length - 2];
      setNavHistory(h => h.slice(0, -1));
      setPage(prev);
    } else {
      setPage('home');
      setNavHistory(['home']);
    }
    window.scrollTo(0, 0);
  };

  if (!session) {
    return <LoginScreen onLogin={(s) => {
      localStorage.setItem('beepai_session', JSON.stringify(s));
      setSession(s);
    }} />;
  }

  return (
    <div className="app">
      <Header onLogout={logout} username={session.username} isAdmin={session.isAdmin} navigate={navigate} page={page} />
      <NavBar page={page} navigate={navigatePrimary} />
      <AlertBanner />
      <PageTopBar page={page} onBack={goBack} onClose={() => { setPage('home'); setNavHistory(['home']); window.scrollTo(0,0); }} />
      <main className="app-main">
        {page === 'home'      && <HomePage   navigate={navigate} />}
        {page === 'charts'    && <ChartsPage />}
        {page === 'crypto'    && <CryptoPage />}
        {page === 'news'      && <NewsPage   />}
        {page === 'alerts'    && <AlertsPage />}
        {page === 'model-w'   && <ModelWPage />}
        {page === 'model-bit' && <ModelBitPage />}
        {page === 'model-smc' && <ModelSmcPage />}
        {page === 'finviz'    && <FinvizPage />}
        {page === 'etoro'     && <EtoroPage  />}
        {page === 'twitter'   && <TwitterPage />}
        {page === 'daily'     && <DailyPage  />}
        {page === 'sot'       && <ScanOfTodayPage navigate={navigate} />}
        {page === '404'       && <NotFoundPage navigate={navigate} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AlertsProvider>
      <OfflineBanner />
      <AppInner />
    </AlertsProvider>
  );
}
