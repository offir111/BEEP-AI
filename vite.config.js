import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TGM — מאפשר ל-/api/tgm-telegram לעבוד גם בשרת הפיתוח המקומי (vite),
// כדי לבדוק "מצב חי" על localhost בלי פריסה. בפרודקשן (Vercel) רץ api/tgm-telegram.js.
function tgmTelegramDevApi() {
  return {
    name: 'tgm-telegram-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/tgm-telegram', async (req, res) => {
        try {
          const { fetchChannelSignals, TELEGRAM_CHANNELS } = await server.ssrLoadModule('/api/_tgmTelegram.js');
          const url = new URL(req.url, 'http://localhost');
          const channel = url.searchParams.get('channel') || 'all';
          const channels = channel === 'all' ? Object.keys(TELEGRAM_CHANNELS) : [channel];
          const results = await Promise.allSettled(channels.map((c) => fetchChannelSignals(c)));
          const signals = [];
          const errors = [];
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') signals.push(...r.value);
            else errors.push({ channel: channels[i], error: r.reason?.message || String(r.reason) });
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ signals, errors, channels }));
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tgmTelegramDevApi()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  }
});
