// apiBase לבדיקות LIVE ב-Node — מצביע לשרת הדב המקומי.
export const API_BASE = process.env.TGM_TEST_ORIGIN || 'http://localhost:5191';
export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
