import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { apiUrl } from '../utils/apiBase';

// ── Symbol classification ─────────────────────────────────────────────────────

const STOCK_API_MAP = {
  'S&P':    '^GSPC',
  'SP500':  '^GSPC',
  'GOLD':   'GC=F',
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
  // Map of symbol → { price, change, high, low, vol, volBase, flash, stale, marketState, noData, ts }
  const [quotes, setQuotes] = useState({});

  // Crypto WebSocket connection status: 'connecting' | 'live' | 'disconnected'
  const [wsStatus, setWsStatus] = useState('connecting');

  // Set of currently subscribed symbols (uppercased)
  const subscribedRef = useRef(new Set());

  // WebSocket refs
  const wsRef        = useRef(null);
  const reconnTimer  = useRef(null);
  const batchTimer   = useRef(null);
  const reconnTries  = useRef(0);          // for exponential backoff

  // Stock polling intervals: symbol → intervalId
  const stockTimers = useRef({});
  // Consecutive failed stock polls: symbol → count (drives the "no data" state)
  const stockFails  = useRef({});

  // Flash timers: symbol → timeoutId
  const flashTimers = useRef({});

  // ── Unified quote update (handles flash logic) ───────────────────────────────
  // Extra fields (vol, volBase, stale, marketState, noData, ts) are merged onto
  // the stored quote when provided, but never clobbered with undefined.
  const updateQuote = useCallback((symbol, fields) => {
    const sym = symbol.toUpperCase();
    const { price } = fields;
    setQuotes(prev => {
      const prev_ = prev[sym] || {};
      const prevPrice = prev_.price;
      const direction =
        price == null || prevPrice == null ? null :
        price > prevPrice ? 'up' :
        price < prevPrice ? 'down' : null;

      // Merge, keeping previous values for any field not explicitly supplied.
      const next = { ...prev_ };
      for (const k of Object.keys(fields)) {
        if (fields[k] !== undefined) next[k] = fields[k];
      }
      next.flash = direction ?? prev_.flash ?? null;

      if (direction) {
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

  // ── WebSocket (crypto) with exponential-backoff reconnect ────────────────────

  const connectWS = useCallback(() => {
    const cryptoSymbols = [...subscribedRef.current].filter(isCrypto);
    if (cryptoSymbols.length === 0) {
      setWsStatus('connecting');
      return;
    }

    // Close existing connection (intentional — suppress auto-reconnect)
    if (wsRef.current) {
      wsRef.current.onclose = null;
      try { wsRef.current.close(); } catch { /* noop */ }
      wsRef.current = null;
    }

    setWsStatus(reconnTries.current > 0 ? 'disconnected' : 'connecting');

    const streams = cryptoSymbols.map(toBinanceStream).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnTries.current = 0;
      setWsStatus('live');
    };

    ws.onmessage = (event) => {
      try {
        const msg  = JSON.parse(event.data);
        const data = msg.data || msg;
        if (!data || !data.s) return;

        // Strip USDT suffix to get our symbol key
        const rawSym = data.s.toUpperCase();
        const symbol = rawSym.endsWith('USDT') ? rawSym.slice(0, -4) : rawSym;
        const close  = parseFloat(data.c);
        const open   = parseFloat(data.o);
        const high   = parseFloat(data.h);
        const low    = parseFloat(data.l);
        // Binance @miniTicker: q = quote-asset (USDT) volume, v = base-asset volume.
        const quoteVol = parseFloat(data.q);
        const baseVol  = parseFloat(data.v);
        const change   = open !== 0 ? ((close - open) / open) * 100 : 0;

        updateQuote(symbol, {
          price: close,
          change,
          high,
          low,
          vol:     Number.isFinite(quoteVol) ? quoteVol : null,
          volBase: Number.isFinite(baseVol)  ? baseVol  : null,
          stale: false,
          marketState: 'OPEN',
          noData: false,
          ts: Date.now(),
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      try { ws.close(); } catch { /* noop */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setWsStatus('disconnected');
      scheduleReconnect();
    };
  }, [updateQuote]);

  // Exponential backoff: 2s, 4s, 8s … capped at 30s.
  const scheduleReconnect = useCallback(() => {
    if (reconnTimer.current) clearTimeout(reconnTimer.current);
    const delay = Math.min(2000 * 2 ** reconnTries.current, 30000);
    reconnTries.current += 1;
    reconnTimer.current = setTimeout(() => connectWS(), delay);
  }, [connectWS]);

  // ── Stock polling (via /api/market serverless proxy) ─────────────────────────

  const startStockPoll = useCallback((symbol) => {
    if (stockTimers.current[symbol]) return; // already polling

    const apiSymbol = STOCK_API_MAP[symbol] || symbol;
    stockFails.current[symbol] = 0;

    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/market?symbol=${encodeURIComponent(apiSymbol)}`));
        if (!res.ok) { registerFail(symbol); return; }
        const d = await res.json();

        if (!d || d.price == null) {
          registerFail(symbol);
          return;
        }

        stockFails.current[symbol] = 0;
        const price  = parseFloat(d.price);
        const rawChange = d.change ?? d.changePercent;
        const change = rawChange != null ? parseFloat(rawChange) : null;
        const high   = d.high  != null ? parseFloat(d.high)   : null;
        const low    = d.low   != null ? parseFloat(d.low)    : null;
        const vol    = d.volume != null ? parseFloat(d.volume) : null;

        updateQuote(symbol, {
          price, change, high, low,
          vol: Number.isFinite(vol) ? vol : null,
          stale: !!d.stale,
          marketState: d.marketState ?? null,
          noData: false,
          ts: Date.now(),
        });
      } catch {
        registerFail(symbol);
      }
    };

    poll(); // immediate first fetch
    stockTimers.current[symbol] = setInterval(poll, 15000);
  }, [updateQuote]);

  // After 2 consecutive failures with no prior price, surface a "no data" state
  // so the UI can stop showing an infinite skeleton.
  const registerFail = useCallback((symbol) => {
    const sym = symbol.toUpperCase();
    stockFails.current[symbol] = (stockFails.current[symbol] || 0) + 1;
    if (stockFails.current[symbol] >= 2) {
      setQuotes(prev => {
        const cur = prev[sym] || {};
        if (cur.price != null) return prev; // we already have a price; keep it
        return { ...prev, [sym]: { ...cur, noData: true } };
      });
    }
  }, []);

  const stopStockPoll = useCallback((symbol) => {
    if (stockTimers.current[symbol]) {
      clearInterval(stockTimers.current[symbol]);
      delete stockTimers.current[symbol];
    }
    delete stockFails.current[symbol];
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
      reconnTries.current = 0;
      if (batchTimer.current) clearTimeout(batchTimer.current);
      batchTimer.current = setTimeout(() => connectWS(), 150);
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
      reconnTries.current = 0;
      if (batchTimer.current) clearTimeout(batchTimer.current);
      batchTimer.current = setTimeout(() => connectWS(), 150);
    }
  }, [connectWS, stopStockPoll]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      if (batchTimer.current)  clearTimeout(batchTimer.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        try { wsRef.current.close(); } catch { /* noop */ }
        wsRef.current = null;
      }

      Object.values(stockTimers.current).forEach(clearInterval);
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <LiveQuoteContext.Provider value={{ quotes, wsStatus, subscribe, unsubscribe }}>
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
    price:       quote?.price       ?? null,
    change:      quote?.change      ?? null,
    high:        quote?.high        ?? null,
    low:         quote?.low         ?? null,
    vol:         quote?.vol         ?? null,   // quote-asset (USDT/$) volume for crypto, share volume for stocks
    volBase:     quote?.volBase     ?? null,   // base-asset volume (crypto only)
    flash:       quote?.flash       ?? null,
    stale:       quote?.stale       ?? false,  // true when price is a last-close (market closed)
    marketState: quote?.marketState ?? null,
    noData:      quote?.noData      ?? false,  // true when the feed could not return any price
    ts:          quote?.ts          ?? null,
  };
}

// ── useWsStatus hook ──────────────────────────────────────────────────────────
// 'connecting' | 'live' | 'disconnected' — for the crypto WebSocket.
export function useWsStatus() {
  const ctx = useContext(LiveQuoteContext);
  return ctx?.wsStatus ?? 'connecting';
}

export default LiveQuoteContext;
