// /api/scan.js — Vercel Serverless Function
// Scans top US stocks + custom symbol, ranks by momentum score
// Returns { results: [...], top3: [...] }

const STOCKS = [
  { symbol: 'NVDA',  name: 'Nvidia'      },
  { symbol: 'AAPL',  name: 'Apple'       },
  { symbol: 'MSFT',  name: 'Microsoft'   },
  { symbol: 'GOOGL', name: 'Alphabet'    },
  { symbol: 'AMZN',  name: 'Amazon'      },
  { symbol: 'META',  name: 'Meta'        },
  { symbol: 'TSLA',  name: 'Tesla'       },
  { symbol: 'PLTR',  name: 'Palantir'    },
  { symbol: 'AMD',   name: 'AMD'         },
  { symbol: 'NFLX',  name: 'Netflix'     },
  { symbol: 'JPM',   name: 'JPMorgan'    },
  { symbol: 'V',     name: 'Visa'        },
  { symbol: 'MA',    name: 'Mastercard'  },
  { symbol: 'UNH',   name: 'UnitedHealth'},
  { symbol: 'COIN',  name: 'Coinbase'    },
  { symbol: 'MSTR',  name: 'MicroStrategy'},
  { symbol: 'SMCI',  name: 'Super Micro' },
  { symbol: 'CRWD',  name: 'CrowdStrike' },
  { symbol: 'SHOP',  name: 'Shopify'     },
  { symbol: 'SQ',    name: 'Block'       },
];

function getSignal(change) {
  if (change >= 3)  return 'STRONG BUY';
  if (change >= 1)  return 'BUY';
  if (change <= -3) return 'STRONG SELL';
  if (change <= -1) return 'SELL';
  return 'HOLD';
}

function calcScore(change) {
  // Score 0-100 centered at 50, 8 pts per % change
  return Math.max(3, Math.min(99, Math.round(50 + change * 8)));
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com',
};

async function batchQuote(symbolList) {
  const syms = symbolList.join(',');
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketChangePercent,shortName`;
      const r = await fetch(url, { headers: YAHOO_HEADERS });
      if (!r.ok) continue;
      const data = await r.json();
      const quotes = data?.quoteResponse?.result;
      if (quotes && quotes.length > 0) return quotes;
    } catch { /* try next host */ }
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const customSym = (req.query?.symbol || '').trim().toUpperCase();

  // Build list to scan
  let scanList = STOCKS;
  if (customSym) {
    // Custom symbol: search just that one, prepend to list
    const exists = STOCKS.find(s => s.symbol === customSym);
    if (!exists) scanList = [{ symbol: customSym, name: customSym }, ...STOCKS];
  }

  try {
    const symbolNames = Object.fromEntries(scanList.map(s => [s.symbol, s.name]));
    const symbols = scanList.map(s => s.symbol);

    const quotes = await batchQuote(symbols);

    const results = quotes
      .filter(q => q.regularMarketPrice != null)
      .map(q => {
        const change = parseFloat((q.regularMarketChangePercent ?? 0).toFixed(2));
        return {
          symbol: q.symbol,
          name: q.shortName || symbolNames[q.symbol] || q.symbol,
          price: parseFloat(q.regularMarketPrice.toFixed(2)),
          change,
          signal: getSignal(change),
          score: calcScore(change),
        };
      })
      .sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      return res.status(200).json({
        error: 'no_data',
        results: [],
        top3: [],
      });
    }

    const top3 = results.slice(0, 3);
    return res.status(200).json({ results, top3 });

  } catch (err) {
    return res.status(500).json({ error: err.message, results: [], top3: [] });
  }
}
