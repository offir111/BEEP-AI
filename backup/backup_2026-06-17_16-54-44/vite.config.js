import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// מריץ את פונקציות ה-Serverless שב-api/ גם בשרת הפיתוח המקומי (vite).
// בלי זה, vite מגיש את קובץ ה-JS הגולמי במקום להריץ אותו → ה-fetch מקבל קוד במקום JSON
// וכל עמוד שתלוי ב-/api (גיינרז, סקרינר, טלגרם וכו') נשאר ריק. בפרודקשן (Vercel) זה רץ אוטומטית.
function devApiServer() {
  return {
    name: 'dev-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const u = new URL(req.url, 'http://localhost');
        const name = u.pathname.slice('/api/'.length).replace(/\/+$/, '');
        if (!name) return next();

        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`);
        } catch {
          return next(); // אין קובץ כזה — שיטופל ע"י vite
        }
        const handler = mod?.default;
        if (typeof handler !== 'function') return next();

        req.query = Object.fromEntries(u.searchParams.entries());

        if (req.method === 'POST' || req.method === 'PUT') {
          req.body = await new Promise((resolve) => {
            let data = '';
            req.on('data', (c) => (data += c));
            req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
          });
        }

        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
          return res;
        };

        try {
          await handler(req, res);
        } catch (e) {
          if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); }
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiServer()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  }
});
