import { useState } from 'react';
import LoginScreen  from './components/LoginScreen';
import Header       from './components/Header';
import NavBar       from './components/NavBar';
import HomePage     from './pages/HomePage';
import ChartsPage   from './pages/ChartsPage';
import CryptoPage   from './pages/CryptoPage';
import NewsPage     from './pages/NewsPage';
import ModelWPage   from './pages/ModelWPage';
import ModelBitPage from './pages/ModelBitPage';
import ModelSmcPage from './pages/ModelSmcPage';
import FinvizPage   from './pages/FinvizPage';
import EtoroPage    from './pages/EtoroPage';
import TwitterPage  from './pages/TwitterPage';
import DailyPage    from './pages/DailyPage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

const VALID_PAGES = [
  'home','charts','crypto','news',
  'model-w','model-bit','model-smc',
  'finviz','etoro','twitter','daily'
];

export default function App() {
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
      <main className="app-main">
        {page === 'home'      && <HomePage   navigate={navigate} />}
        {page === 'charts'    && <ChartsPage />}
        {page === 'crypto'    && <CryptoPage />}
        {page === 'news'      && <NewsPage   />}
        {page === 'model-w'   && <ModelWPage />}
        {page === 'model-bit' && <ModelBitPage />}
        {page === 'model-smc' && <ModelSmcPage />}
        {page === 'finviz'    && <FinvizPage />}
        {page === 'etoro'     && <EtoroPage  />}
        {page === 'twitter'   && <TwitterPage />}
        {page === 'daily'     && <DailyPage  />}
        {page === '404'       && <NotFoundPage navigate={navigate} />}
      </main>
    </div>
  );
}
