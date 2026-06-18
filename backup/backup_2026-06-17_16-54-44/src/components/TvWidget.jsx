// Generic TradingView widget wrapper (copied from BEEP BEEP)
// Each widget type is an external script that reads its config from script innerHTML
import { useEffect, useRef, useState, useCallback } from 'react';

const SAFE_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
const TIMEOUT_MS   = 12000; // show error if iframe doesn't appear within 12s

export default function TvWidget({ src, config, style, hideNotice, blockNav = true, leftOffset = 0 }) {
  const wrapRef    = useRef();
  const timerRef   = useRef();
  const configKey  = JSON.stringify(config);

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setRetryKey(k => k + 1);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    setStatus('loading');
    clearTimeout(timerRef.current);

    // Clear previous instance
    wrap.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.cssText = hideNotice ? 'height:100%;width:100%' : 'height:calc(100% - 32px);width:100%';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = true;
    script.innerHTML = JSON.stringify({ ...config, isTransparent: true });

    // Script load error → immediate error state
    script.onerror = () => setStatus('error');

    const notice = document.createElement('div');
    notice.className = 'tradingview-widget-copyright';
    notice.innerHTML = '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color:#000000"><span style="color:#000000">Track all markets on TradingView</span></a>';
    notice.style.cssText = 'display:none';

    wrap.appendChild(inner);
    wrap.appendChild(script);
    if (!hideNotice) wrap.appendChild(notice);

    if (hideNotice) {
      const cover = document.createElement('div');
      cover.style.cssText = 'position:absolute;bottom:0;left:0;width:160px;height:28px;background:#131722;z-index:10;pointer-events:none';
      wrap.appendChild(cover);
    }

    // Watch for TradingView iframe appearing → widget loaded OK
    let observer;
    const patchIframe = (iframe) => {
      clearTimeout(timerRef.current);
      setStatus('ok');
      if (!blockNav) return;
      try {
        const existing = iframe.getAttribute('sandbox');
        if (existing === null) {
          iframe.setAttribute('sandbox', SAFE_SANDBOX);
        } else {
          iframe.setAttribute('sandbox',
            existing
              .replace(/allow-top-navigation-by-user-activation/g, '')
              .replace(/allow-top-navigation/g, '')
              .trim() || SAFE_SANDBOX
          );
        }
      } catch (_) {}
    };

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'IFRAME') patchIframe(node);
          node.querySelectorAll?.('iframe').forEach(patchIframe);
        }
      }
    });
    observer.observe(wrap, { childList: true, subtree: true });

    // Timeout fallback — if iframe never appears
    timerRef.current = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'error' : prev);
    }, TIMEOUT_MS);

    return () => {
      observer?.disconnect();
      clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, configKey, retryKey]);

  return (
    <div
      style={{ flex: '1 1 0', minHeight: 0, width: '100%', position: 'relative', ...style }}
    >
      {/* Actual widget (always mounted so it can load) */}
      <div
        ref={wrapRef}
        className="tradingview-widget-container"
        style={{
          height: '100%', position: 'absolute',
          top: 0, right: 0, bottom: 0, left: leftOffset,
          visibility: status === 'ok' ? 'visible' : 'hidden',
          pointerEvents: status === 'ok' ? 'auto' : 'none',
        }}
      />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#050a0e',
          gap: 10,
        }}>
          <span style={{ color: '#D4AF37', fontSize: '0.85rem', opacity: 0.8 }}>טוען גרף…</span>
          <div style={{
            width: 28, height: 28,
            border: '3px solid rgba(212,175,55,0.15)',
            borderTopColor: '#D4AF37',
            borderRadius: '50%',
            animation: 'tvSpinKf 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#050a0e',
          gap: 12,
        }}>
          <span style={{ fontSize: '1.6rem' }}>📡</span>
          <span style={{ color: '#e2d5a0', fontSize: '0.85rem', fontWeight: 600 }}>
            לא ניתן להתחבר ל-TradingView
          </span>
          <span style={{ color: '#6B7280', fontSize: '0.72rem', textAlign: 'center', maxWidth: 220 }}>
            בדוק חיבור לאינטרנט או נסה שוב
          </span>
          <button
            onClick={retry}
            style={{
              marginTop: 4,
              padding: '6px 20px',
              background: 'transparent',
              border: '1px solid rgba(212,175,55,0.55)',
              borderRadius: 6,
              color: '#D4AF37',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🔄 נסה שוב
          </button>
        </div>
      )}

      {/* Spinner keyframe (injected once) */}
      <style>{`@keyframes tvSpinKf { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
