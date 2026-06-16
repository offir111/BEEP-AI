// BUG-04: Iframe wrapper with loading state and timeout fallback
import { useState, useEffect, useRef } from 'react';
import './IframeWithFallback.css';

export default function IframeWithFallback({ src, title, className, style, iframeKey }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const timerRef = useRef(null);

  useEffect(() => {
    setStatus('loading');
    timerRef.current = setTimeout(() => setStatus('error'), 12000);
    return () => clearTimeout(timerRef.current);
  }, [src, iframeKey]);

  const handleLoad = () => {
    clearTimeout(timerRef.current);
    setStatus('ready');
  };

  return (
    <div className="iframe-wrap" style={style}>
      {status === 'loading' && (
        <div className="iframe-overlay iframe-overlay--loading" aria-live="polite">
          <div className="iframe-spinner" aria-hidden="true" />
          <span>טוען גרף...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="iframe-overlay iframe-overlay--error" role="alert">
          <span>⚠️</span>
          <span>לא ניתן לטעון את הגרף</span>
          <button onClick={() => setStatus('loading')} className="iframe-retry">
            🔄 נסה שוב
          </button>
        </div>
      )}
      <iframe
        key={iframeKey || src}
        src={src}
        title={title}
        className={className}
        onLoad={handleLoad}
        allowFullScreen
        style={{ opacity: status === 'ready' ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </div>
  );
}
