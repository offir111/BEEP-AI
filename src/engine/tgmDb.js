// TGM — אחסון לידים ב-IndexedDB (לא localStorage), עמיד וא-סינכרוני.
// כל ליד נשמר ברשומה אחת עם מזהה ייחודי.

const DB_NAME = 'tgm_leads_db';
const DB_VERSION = 1;
const STORE = 'leads';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB אינו נתמך בדפדפן זה'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('provider', 'provider', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLeads() {
  const store = await tx('readonly');
  const all = await reqToPromise(store.getAll());
  // מיון לפי תאריך הליד (חדש→ישן)
  return all.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
}

export async function saveLead(lead) {
  const store = await tx('readwrite');
  await reqToPromise(store.put(lead));
  return lead;
}

export async function deleteLead(id) {
  const store = await tx('readwrite');
  await reqToPromise(store.delete(id));
}

export async function clearAllLeads() {
  const store = await tx('readwrite');
  await reqToPromise(store.clear());
}

// מזהה ייחודי לליד (ללא תלות בספריות חיצוניות).
export function newLeadId() {
  const rand = Math.random().toString(36).slice(2, 10);
  // performance.now נותן רכיב יחודי גם אם נוצרים כמה לידים באותה מילישנייה
  const t = Math.floor(performance.now() * 1000).toString(36);
  return `lead_${t}_${rand}`;
}
