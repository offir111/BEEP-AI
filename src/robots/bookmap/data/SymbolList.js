/**
 * SymbolList — fetches the real tradable USDT-pair universe from Binance
 * exchangeInfo (via the Vercel proxy so a client-side block can't break it).
 *
 * Returns sorted symbols with status === 'TRADING' and quoteAsset === 'USDT'.
 * A short popular-first list is surfaced for quick access.
 */
import { apiUrl } from '../../../utils/apiBase';

const POPULAR = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

let _cache = null;

export async function fetchUsdtSymbols() {
  if (_cache) return _cache;
  const url = apiUrl('/api/binance?ep=exchangeInfo');
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('exchangeInfo ' + r.status);
  const data = await r.json();
  const syms = (data.symbols || [])
    .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.isSpotTradingAllowed !== false)
    .map(s => s.symbol)
    .sort();
  _cache = syms;
  return syms;
}

export function popularFirst(all) {
  const set = new Set(all);
  const top = POPULAR.filter(s => set.has(s));
  const rest = all.filter(s => !top.includes(s));
  return [...top, ...rest];
}

export { POPULAR };
