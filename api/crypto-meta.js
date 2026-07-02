/**
 * /api/crypto-meta?symbol=BTC
 * שווי-שוק + שם מלא למטבע קריפטו, מ-CoinGecko (חינמי, אמיתי). cache 5 דק'.
 * מאפשר להציג בחלונית המחיר של גרפי הקריפטו M.C אמיתי (כמו למניות).
 */
const IDS = {
  BTC: { id: 'bitcoin', name: 'Bitcoin' },
  ETH: { id: 'ethereum', name: 'Ethereum' },
  SOL: { id: 'solana', name: 'Solana' },
  BNB: { id: 'binancecoin', name: 'BNB' },
  XRP: { id: 'ripple', name: 'XRP' },
  DOGE: { id: 'dogecoin', name: 'Dogecoin' },
  ADA: { id: 'cardano', name: 'Cardano' },
  AVAX: { id: 'avalanche-2', name: 'Avalanche' },
  LINK: { id: 'chainlink', name: 'Chainlink' },
  MATIC: { id: 'matic-network', name: 'Polygon' },
  DOT: { id: 'polkadot', name: 'Polkadot' },
  LTC: { id: 'litecoin', name: 'Litecoin' },
};

export function coinInfo(symbol) {
  const s = String(symbol || '').toUpperCase().replace(/USDT?$|-USD$/,'');
  return IDS[s] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info = coinInfo(req.query?.symbol);
  if (!info) return res.status(200).json({ symbol: req.query?.symbol || null, name: null, marketCap: null, live: false });

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${info.id}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9000) }
    );
    if (r.ok) {
      const d = await r.json();
      const row = d[info.id];
      if (row) {
        return res.status(200).json({
          symbol: req.query.symbol, name: info.name,
          marketCap: Number.isFinite(row.usd_market_cap) ? row.usd_market_cap : null,
          change24h: Number.isFinite(row.usd_24h_change) ? row.usd_24h_change : null,
          live: true,
        });
      }
    }
  } catch { /* fall through */ }
  return res.status(200).json({ symbol: req.query.symbol, name: info.name, marketCap: null, live: false });
}
