/* ── favorites.js — localStorage CRUD for personal watchlist ── */
const KEY = 'beepai_favs';

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { crypto: [], stocks: [] }; }
  catch { return { crypto: [], stocks: [] }; }
}

export function isFavorite(assetType, id) {
  const f = getFavorites();
  return assetType === 'crypto'
    ? f.crypto.includes(id)
    : f.stocks.includes(String(id).toUpperCase());
}

/** Toggle a favorite. Returns true if now added, false if removed. */
export function toggleFavorite(assetType, id) {
  const f   = getFavorites();
  const key = assetType === 'crypto' ? 'crypto' : 'stocks';
  const val = assetType === 'crypto' ? id : String(id).toUpperCase();
  const idx = f[key].indexOf(val);
  if (idx >= 0) f[key].splice(idx, 1);
  else          f[key].push(val);
  localStorage.setItem(KEY, JSON.stringify(f));
  return idx < 0;
}

export function clearFavorites() {
  localStorage.removeItem(KEY);
}
