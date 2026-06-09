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

function AppInner() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('beepai_session')); } catch { return null; }
  });
  const [page, setPage] = useState('home');

  const logout = () => {
    localStorage.removeItem('beepai_session');
    setSession(null);
  };

  const navigate = (p) => {
    setPage(VALID_PAGES.includes(p) ? p : '404');
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
      <NavBar page={page} navigate={navigate} />
      <AlertBanner />
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
