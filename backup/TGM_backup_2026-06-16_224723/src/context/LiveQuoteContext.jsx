import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

// ── Symbol classification ─────────────────────────────────────────────────────

const STOCK_API_MAP = {
  'S&P':    '^GSPC',
  'SP500':  '^GSPC',
  'GOLD':   'XAUUSD=X',
  'SILVER': 'XAGUSD=X',
  'OIL':    'CL=F',
  'SPCX':   'SPCX',
  'QQQ':    'QQQ',
  'AAPL':   'AAPL',
  'NVDA':   'NVDA',
  'HUT':    'HUT',
  'MARA':   'MARA',
  'RIOT':   'RIOT',
  'CLSK':   'CLSK',
  'KEEL':   'KEEL',
  // common typos
  'APPL':   'AAPL',
  'NVDIA':  'NVDA',
};

const CRYPTO_SET = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA',
  'DOT', 'AVAX', 'MATIC', 'LINK', 'ATOM', 'BSOL',
  // NOTE: CIFR (Cipher Mining) is a NASDAQ stock, not crypto — polled via /api/market.
]);

function isCrypto(symbol) {
  return CRYPTO_SET.has(symbol.toUpperCase());
}

function toBinanceStream(symbol) {
  return `${symbol.toLowerCase()}usdt@miniTicker`;
}

// ── Context ───────────────────────────────────────────────────────────────────

const LiveQuoteContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function LiveQuoteProvider({ children }) {
  // Map of symbol → { price, change, high, low, flash }
  const [quotes, setQuotes] = useState({});

  // Set of currently subscribed symbols (uppercased)
  const subscribedRef = useRef(new Set());

  // WebSocket ref
  const wsRef       = useRef(null);
  const reconnTimer = useRef(null);
  const batchTimer  = useRef(null);

  // Stock polling intervals: symbol → intervalId
  const stockTimers = useRef({});

  // Flash timers: symbol → timeoutId
  const flashTimers = useRef({});

  // ── Flash helper ────────────────────────────────────────────────────────────

  const setFlash = useCallback((symbol, direction) => {
    if (flashTimers.current[symbol]) clearTimeout(flashTimers.current[symbol]);
    setQuotes(prev => ({
      ...prev,
      [symbol]: { ...(prev[symbol] || {}), flash: direction },
    }));
    flashTimers.current[symbol] = setTimeout(() => {
      setQuotes(prev => ({
        ...prev,
        [symbol]: { ...(prev[symbol] || {}), flash: null },
      }));
    }, 1400);
  }, []);

  // ── Quote update helper ──────────────────────────────────────────────────────

  const applyQuote = useCallback((symbol, { price, change, high, low }) => {
    setQuotes(prev => {
      const prev_ = prev[symbol] || {};
      const prevPrice = prev_.price;
      const direction =
        prevPrice == null ? null :
        price > prevPrice ? 'up' :
        price < prevPrice ? 'down' : null;
      return {
        ...prev,
        [symbol]: { price, change, high, low, flash: direction ?? prev_.flash ?? null },
      };
    });
    // Trigger flash separately so we can schedule its removal
    setQuotes(prev => {
      const current = prev[symbol];
      if (!current || current.flash === null) return prev;
      return prev; // flash state already set above; removal handled by setFlash
    });
  }, []);

  // Unified update that handles flash logic:
  const updateQuote = useCallback((symbol, { price, change, high, low }) => {
    const sym = symbol.toUpperCase();
    setQuotes(prev => {
      const prev_ = prev[sym] || {};
      const prevPrice = prev_.price;
      const direction =
        prevPrice == null ? null :
        price > prevPrice ? 'up' :
        price < prevPrice ? 'down' : null;

      const next = { price, change, high, low, flash: direction };
      if (direction) {
        // schedule flash clear
        if (flashTimers.current[sym]) clearTimeout(flashTimers.current[sym]);
        flashTimers.current[sym] = setTimeout(() => {
          setQuotes(q => ({
            ...q,
            [sym]: { ...(q[sym] || {}), flash: null },
          }));
        }, 1400);
      }
      return { ...prev, [sym]: next };
    });
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────────────

  const connectWS = useCallback(() => {
    const cryptoSymbols = [...subscribedRef.current].filter(isCrypto);
    if (cryptoSymbols.length === 0) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent auto-reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }

    const streams = cryptoSymbols.map(toBinanceStream).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg  = JSON.parse(event.data);
        const data = msg.data || msg;
        if (!data || !data.s) return;

        // Strip USDT suffix to get our symbol key
        const rawSym   = data.s.toUpperCase();
        const symbol   = rawSym.endsWith('USDT') ? rawSym.slice(0, -4) : rawSym;
        const close    = parseFloat(data.c);
        const open     = parseFloat(data.o);
        const high     = parseFloat(data.h);
        const low      = parseFloat(data.l);
        const change   = open !== 0 ? ((close - open) / open) * 100 : 0;

        updateQuote(symbol, { price: close, change, high, low });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Auto-reconnect after 3s unless we intentionally closed
      reconnTimer.current = setTimeout(() => {
        connectWS();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [updateQuote]);

  // ── Stock polling ────────────────────────────────────────────────────────────

  const startStockPoll = useCallback((symbol) => {
    if (stockTimers.current[symbol]) return; // already polling

    const apiSymbol = STOCK_API_MAP[symbol] || symbol;

    const poll = async () => {
      try {
        const res = await fetch(`/api/market?symbol=${encodeURIComponent(apiSymbol)}`);
        if (!res.ok) return;
        const d = await res.json();
        if (!d || d.price == null) return;

        const price  = parseFloat(d.price);
        // /api/market returns the daily move as `changePercent` (accept `change` too for safety).
        const rawChange = d.change ?? d.changePercent;
        const change = rawChange != null ? parseFloat(rawChange) : null;
        const high   = d.high  != null ? parseFloat(d.high)   : null;
        const low    = d.low   != null ? parseFloat(d.low)    : null;

        updateQuote(symbol, { price, change, high, low });
      } catch {
        // network error — silently skip
      }
    };

    poll(); // immediate first fetch
    stockTimers.current[symbol] = setInterval(poll, 15000);
  }, [updateQuote]);

  const stopStockPoll = useCallback((symbol) => {
    if (stockTimers.current[symbol]) {
      clearInterval(stockTimers.current[symbol]);
      delete stockTimers.current[symbol];
    }
  }, []);

  // ── Subscribe / Unsubscribe ──────────────────────────────────────────────────

  const subscribe = useCallback((symbols) => {
    let wsNeedsReconnect = false;

    for (const raw of symbols) {
      const sym = raw.toUpperCase().trim();
      if (!sym) continue;
      if (subscribedRef.current.has(sym)) continue;

      subscribedRef.current.add(sym);

      if (isCrypto(sym)) {
        wsNeedsReconnect = true;
      } else {
        startStockPoll(sym);
      }
    }

    if (wsNeedsReconnect) {
      // Batch: wait 150ms before reconnecting in case more subscribe() calls arrive
      if (batchTimer.current) clearTimeout(batchTimer.current);
      batchTimer.current = setTimeout(() => {
        connectWS();
      }, 150);
    }
  }, [connectWS, startStockPoll]);

  const unsubscribe = useCallback((symbols) => {
    let wsNeedsReconnect = false;

    for (const raw of symbols) {
      const sym = raw.toUpperCase().trim();
      if (!sym) continue;
      if (!subscribedRef.current.has(sym)) continue;

      subscribedRef.current.delete(sym);

      if (isCrypto(sym)) {
        wsNeedsReconnect = true;
      } else {
        stopStockPoll(sym);
      }

      // Clean up flash timer
      if (flashTimers.current[sym]) {
        clearTimeout(flashTimers.current[sym]);
        delete flashTimers.current[sym];
      }
    }

    if (wsNeedsReconnect) {
      if (batchTimer.current) clearTimeout(batchTimer.current);
      batchTimer.current = setTimeout(() => {
        connectWS();
      }, 150);
    }
  }, [connectWS, stopStockPoll]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      if (batchTimer.current)  clearTimeout(batchTimer.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      Object.values(stockTimers.current).forEach(clearInterval);
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <LiveQuoteContext.Provider value={{ quotes, subscribe, unsubscribe }}>
      {children}
    </LiveQuoteContext.Provider>
  );
}

// ── useQuote hook ─────────────────────────────────────────────────────────────

export function useQuote(symbol) {
  const ctx = useContext(LiveQuoteContext);
  if (!ctx) throw new Error('useQuote must be used inside <LiveQuoteProvider>');

  const sym = symbol ? symbol.toUpperCase().trim() : '';
  const quote = ctx.quotes[sym];

  return {
    price:  quote?.price  ?? null,
    change: quote?.change ?? null,
    high:   quote?.high   ?? null,
    low:    quote?.low    ?? null,
    flash:  quote?.flash  ?? null,
  };
}

export default LiveQuoteContext;
