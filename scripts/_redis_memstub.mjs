// in-memory stub ל-Redis עבור בדיקת ה-Paper Trading (ללא Upstash אמיתי).
const store = new Map();   // key → value (JSON-מקודד כמו ה-REST האמיתי)
const hashes = new Map();  // key → Map(field→value)
export const redis = {
  isReady: () => true,
  get: async (k) => (store.has(k) ? store.get(k) : null),
  set: async (k, v) => { store.set(k, v); },
  del: async (k) => { store.delete(k); hashes.delete(k); },
  hset: async (k, f, v) => { if (!hashes.has(k)) hashes.set(k, new Map()); hashes.get(k).set(String(f), v); },
  hdel: async (k, f) => { hashes.get(k)?.delete(String(f)); },
  hgetall: async (k) => Object.fromEntries(hashes.get(k) || new Map()),
  sadd: async () => {}, smembers: async () => [],
};
