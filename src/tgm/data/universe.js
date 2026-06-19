// TGM · Universe — רשימת היקום (מניות US אמיתיות, נזילות). מודול טהור משותף
// ללקוח ולצד-השרת (Paper Trading cron). השדות marketCapM/price/avgVolM הם עוגני
// ייחוס סטטיים להגדרת ה-watchlist ולמסנן היקום (passesUniverse) — מחירי האמת
// מגיעים מהנרות החיים. חלק מהשורות מתחת לסף בכוונה — לבדיקת המסנן.
export const STOCK_UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.',                sector: 'Technology',     marketCapM: 3100000, price: 198.4, avgVolM: 54 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.',              sector: 'Technology',     marketCapM: 2900000, price: 121.7, avgVolM: 290 },
  { symbol: 'TSLA', name: 'Tesla Inc.',                sector: 'Consumer Disc.', marketCapM: 780000,  price: 246.2, avgVolM: 95 },
  { symbol: 'AMD',  name: 'Advanced Micro Devices',    sector: 'Technology',     marketCapM: 235000,  price: 146.1, avgVolM: 48 },
  { symbol: 'PLTR', name: 'Palantir Technologies',     sector: 'Technology',     marketCapM: 78000,   price: 34.9,  avgVolM: 62 },
  { symbol: 'SOFI', name: 'SoFi Technologies',         sector: 'Financials',     marketCapM: 9200,    price: 8.7,   avgVolM: 41 },
  { symbol: 'RIVN', name: 'Rivian Automotive',         sector: 'Consumer Disc.', marketCapM: 12500,   price: 13.2,  avgVolM: 28 },
  { symbol: 'COIN', name: 'Coinbase Global',           sector: 'Financials',     marketCapM: 58000,   price: 232.5, avgVolM: 14 },
  { symbol: 'MARA', name: 'Marathon Digital',          sector: 'Financials',     marketCapM: 5400,    price: 17.8,  avgVolM: 38 },
  { symbol: 'AFRM', name: 'Affirm Holdings',           sector: 'Financials',     marketCapM: 11000,   price: 36.4,  avgVolM: 9 },
  { symbol: 'SHOP', name: 'Shopify Inc.',              sector: 'Technology',     marketCapM: 96000,   price: 74.3,  avgVolM: 12 },
  { symbol: 'NET',  name: 'Cloudflare Inc.',           sector: 'Technology',     marketCapM: 33000,   price: 96.8,  avgVolM: 4 },
  { symbol: 'DKNG', name: 'DraftKings Inc.',           sector: 'Consumer Disc.', marketCapM: 18000,   price: 38.1,  avgVolM: 11 },
  { symbol: 'UBER', name: 'Uber Technologies',         sector: 'Technology',     marketCapM: 150000,  price: 71.5,  avgVolM: 22 },
  { symbol: 'SNAP', name: 'Snap Inc.',                 sector: 'Comm. Services', marketCapM: 18000,   price: 11.3,  avgVolM: 35, thinData: true },
  { symbol: 'F',    name: 'Ford Motor Co.',            sector: 'Consumer Disc.', marketCapM: 48000,   price: 12.1,  avgVolM: 70 },
  { symbol: 'CCL',  name: 'Carnival Corp.',            sector: 'Consumer Disc.', marketCapM: 24000,   price: 19.4,  avgVolM: 30 },
  { symbol: 'PFE',  name: 'Pfizer Inc.',               sector: 'Healthcare',     marketCapM: 145000,  price: 25.6,  avgVolM: 40 },
  { symbol: 'BAC',  name: 'Bank of America',           sector: 'Financials',     marketCapM: 310000,  price: 40.2,  avgVolM: 38 },
  { symbol: 'INTC', name: 'Intel Corp.',               sector: 'Technology',     marketCapM: 92000,   price: 21.3,  avgVolM: 55 },
  { symbol: 'WBD',  name: 'Warner Bros. Discovery',    sector: 'Comm. Services', marketCapM: 21000,   price: 8.4,   avgVolM: 33 },
  { symbol: 'CHWY', name: 'Chewy Inc.',                sector: 'Consumer Disc.', marketCapM: 12000,   price: 28.7,  avgVolM: 6 },
  { symbol: 'RBLX', name: 'Roblox Corp.',              sector: 'Comm. Services', marketCapM: 26000,   price: 41.2,  avgVolM: 9, thinData: true },
  { symbol: 'ROKU', name: 'Roku Inc.',                 sector: 'Comm. Services', marketCapM: 9500,    price: 64.8,  avgVolM: 5 },
  { symbol: 'CVNA', name: 'Carvana Co.',               sector: 'Consumer Disc.', marketCapM: 32000,   price: 245.0, avgVolM: 7 },
  { symbol: 'DELL', name: 'Dell Technologies',         sector: 'Technology',     marketCapM: 88000,   price: 122.5, avgVolM: 10 },
  { symbol: 'SMCI', name: 'Super Micro Computer',      sector: 'Technology',     marketCapM: 26000,   price: 44.6,  avgVolM: 45 },
  { symbol: 'LCID', name: 'Lucid Group',               sector: 'Consumer Disc.', marketCapM: 6800,    price: 2.9,   avgVolM: 40 }, // price<$3 — נופל
  { symbol: 'NKLA', name: 'Nikola Corp.',              sector: 'Industrials',    marketCapM: 420,     price: 4.1,   avgVolM: 25 }, // mktcap<500M — נופל
  { symbol: 'GME',  name: 'GameStop Corp.',            sector: 'Consumer Disc.', marketCapM: 9100,    price: 24.3,  avgVolM: 8 },
  { symbol: 'BBAI', name: 'BigBear.ai Holdings',       sector: 'Technology',     marketCapM: 380,     price: 3.4,   avgVolM: 12 }, // mktcap<500M — נופל
  { symbol: 'HOOD', name: 'Robinhood Markets',         sector: 'Financials',     marketCapM: 21000,   price: 23.1,  avgVolM: 16 },
  { symbol: 'XPEV', name: 'XPeng Inc.',                sector: 'Consumer Disc.', marketCapM: 8000,    price: 8.9,   avgVolM: 14 },
  { symbol: 'CLF',  name: 'Cleveland-Cliffs',          sector: 'Materials',      marketCapM: 6200,    price: 13.5,  avgVolM: 11 },
  { symbol: 'AA',   name: 'Alcoa Corp.',               sector: 'Materials',      marketCapM: 9800,    price: 38.0,  avgVolM: 7 },
  { symbol: 'MRNA', name: 'Moderna Inc.',              sector: 'Healthcare',     marketCapM: 47000,   price: 122.0, avgVolM: 6 },
];

// alias לשם הישן (תאימות לאחור).
export const MOCK_UNIVERSE = STOCK_UNIVERSE;
