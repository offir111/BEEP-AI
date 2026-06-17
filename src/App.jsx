import { useState, useEffect } from 'react';
import { AlertsProvider }     from './context/AlertsContext';
import { LiveQuoteProvider }  from './context/LiveQuoteContext';
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
import TwitterPage    from './pages/TwitterPage';
import ModelGridPage  from './pages/ModelGridPage';
import DailyPage         from './pages/DailyPage';
import ScanOfTodayPage   from './pages/ScanOfTodayPage';
import HeatmapPage       from './pages/HeatmapPage';
import MyAlertsPage      from './pages/MyAlertsPage';
import ProfilePage       from './pages/ProfilePage';
import GainersPage       from './pages/GainersPage';
import TgmPage           from './pages/TgmPage';
import NotFoundPage      from './pages/NotFoundPage';
import './App.css';

const VALID_PAGES = [
  'home','charts','crypto','news','alerts',
  'model-w','model-bit','model-smc','model-grid',
  'finviz','etoro','twitter','daily','sot','heatmap','myalerts','profile','gainers','tgm'
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
  twitter: '🐦 טוויטר', 'model-grid': '📐 Model Grid', daily: '📅 יומי', sot: '🤖 SOT',
  heatmap: '🗺️ מפת חום',
  myalerts: '🔔 ההתראות שלי',
  profile: '👤 הפרופיל שלי',
  gainers: '🚀 GAINERS — זמן אמת',
  tgm: '🛰️ TGM — סורק לידים',
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
    try {
      const s = JSON.parse(localStorage.getItem('beepai_session'));
      if (s && !s.loginAt) {            // backfill last-login for pre-existing sessions
        s.loginAt = Date.now();
        localStorage.setItem('beepai_session', JSON.stringify(s));
      }
      return s;
    } catch { return null; }
  });
  const [page, setPage] = useState('home');
  const [navHistory, setNavHistory] = useState(['home']);
  const [homeKey, setHomeKey] = useState(0);   // bump → remount HomePage (closes scanner/bubbles)
  const [pageParams, setPageParams] = useState(null);  // optional route params (e.g. { symbol })

  const logout = () => {
    localStorage.removeItem('beepai_session');
    setSession(null);
  };

  // navigate: deep-link, adds to history (back button works). Optional params (e.g. { symbol }).
  const navigate = (p, params = null) => {
    const target = VALID_PAGES.includes(p) ? p : '404';
    if (target === 'home') setHomeKey(k => k + 1);   // logo/home → always reset home view
    setPageParams(params);
    setPage(target);
    setNavHistory(prev => [...prev, target]);
    window.scrollTo(0, 0);
  };

  // navigatePrimary: top-level NavBar click — resets history stack and params
  const navigatePrimary = (p) => {
    const target = VALID_PAGES.includes(p) ? p : '404';
    setPageParams(null);
    setPage(target);
    setNavHistory(['home', target]);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setPageParams(null);
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
      const enriched = { ...s, loginAt: Date.now() };
      localStorage.setItem('beepai_session', JSON.stringify(enriched));
      setSession(enriched);
    }} />;
  }

  return (
    <div className="app">
      <Header onLogout={logout} username={session.username} isAdmin={session.isAdmin} navigate={navigate} page={page} />
      <NavBar page={page} navigate={navigatePrimary} />
      <AlertBanner />
      <PageTopBar page={page} onBack={goBack} onClose={() => { setPageParams(null); setPage('home'); setNavHistory(['home']); window.scrollTo(0,0); }} />
      <main className="app-main">
        {page === 'home'      && <HomePage   key={homeKey} navigate={navigate} />}
        {page === 'charts'    && <ChartsPage initialSymbol={pageParams?.symbol} />}
        {page === 'crypto'    && <CryptoPage />}
        {page === 'news'      && <NewsPage   />}
        {page === 'alerts'    && <AlertsPage />}
        {page === 'model-w'    && <ModelWPage    navigate={navigate} />}
        {page === 'model-bit'  && <ModelBitPage  navigate={navigate} />}
        {page === 'model-smc'  && <ModelSmcPage  navigate={navigate} />}
        {page === 'finviz'     && <FinvizPage     navigate={navigate} />}
        {page === 'etoro'      && <EtoroPage      navigate={navigate} />}
        {page === 'twitter'    && <TwitterPage />}
        {page === 'model-grid' && <ModelGridPage  navigate={navigate} />}
        {page === 'daily'      && <DailyPage      navigate={navigate} />}
        {page === 'sot'        && <ScanOfTodayPage navigate={navigate} />}
        {page === 'heatmap'    && <HeatmapPage />}
        {page === 'myalerts'   && <MyAlertsPage />}
        {page === 'profile'    && <ProfilePage username={session.username} loginAt={session.loginAt} />}
        {page === 'gainers'    && <GainersPage />}
        {page === 'tgm'        && <TgmPage navigate={navigate} />}
        {page === '404'       && <NotFoundPage navigate={navigate} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LiveQuoteProvider>
      <AlertsProvider>
        <OfflineBanner />
        <AppInner />
      </AlertsProvider>
    </LiveQuoteProvider>
  );
}
