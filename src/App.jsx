import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import Header      from './components/Header';
import NavBar      from './components/NavBar';
import HomePage    from './pages/HomePage';
import ChartsPage  from './pages/ChartsPage';
import CryptoPage  from './pages/CryptoPage';
import NewsPage    from './pages/NewsPage';
import './App.css';

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('beepai_session')); } catch { return null; }
  });
  const [page, setPage] = useState('home');

  const logout = () => {
    localStorage.removeItem('beepai_session');
    setSession(null);
  };

  const navigate = (p) => setPage(p);

  if (!session) {
    return <LoginScreen onLogin={(s) => {
      localStorage.setItem('beepai_session', JSON.stringify(s));
      setSession(s);
    }} />;
  }

  return (
    <div className="app">
      <Header onLogout={logout} username={session.username} navigate={navigate} page={page} />
      <NavBar page={page} navigate={navigate} />
      <main className="app-main">
        {page === 'home'   && <HomePage   navigate={navigate} />}
        {page === 'charts' && <ChartsPage />}
        {page === 'crypto' && <CryptoPage />}
        {page === 'news'   && <NewsPage   />}
      </main>
    </div>
  );
}
