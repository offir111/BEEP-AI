// TGM — מנוע איסוף לידים אוטומטי.
// במקום הזנה ידנית, המערכת "אוספת" לידים לכל ספק בעצמה: מושכת מחיר כניסה היסטורי
// אמיתי מ-Binance, קובעת TP/SL לפי פרופיל איכות ייחודי לכל ספק, ומכריעה את התוצאה
// אוטומטית — הכל בבקשת רשת אחת לכל ליד.

import { TGM_PROVIDERS, CHECK_WINDOW_MS } from './tgmProviders';
import { fetchKlines, evaluateOutcome, toBinanceSymbol } from './tgmEngine';
import { newLeadId } from './tgmDb';

const ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT'];

// פרופיל איכות לכל ספק (0=חלש, 1=חזק).
// איכות גבוהה → TP צמוד יותר (קל יותר לפגוע) + SL רחב יותר (קשה יותר לפגוע) → אחוז הצלחה גבוה.
// כך הדירוג נגזר מנתוני Binance אמיתיים אך משקף "מיומנות" שונה בין הספקים.
const PROVIDER_SKILL = {
  'Learn2Trade': 0.78,
  'Evening Trader': 0.55,
  'Wolf of Trading': 0.85,
  'CryptoSignals.org': 0.40,
  'CryptoNinjas': 0.50,
  'altFINS': 0.70,
  'Token Metrics': 0.82,
  'Dash 2 Trade': 0.60,
  'Fed Russian Insiders': 0.30,
  'Binance Killers': 0.88,
};

const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// גוזר טווחי TP/SL וכיוון מתוך מיומנות הספק.
function profileFor(provider) {
  const s = PROVIDER_SKILL[provider] ?? 0.5;
  return {
    tpCenter: lerp(0.042, 0.013, s), // TP%: חלש 4.2% → חזק 1.3%
    slCenter: lerp(0.014, 0.046, s), // SL%: חלש 1.4% → חזק 4.6%
    longBias: lerp(0.45, 0.62, s),   // הטיה ל-LONG בשוק עולה
  };
}

/**
 * יוצר ובודק ליד יחיד אוטומטית (בקשת רשת אחת).
 * dateMs נבחר כך שחלון 14 הימים מסתיים בעבר → לרוב מתקבלת הכרעה ודאית.
 */
export async function generateAndCheckLead(provider) {
  const prof = profileFor(provider);
  const asset = pick(ASSETS);
  const symbol = toBinanceSymbol(asset);

  // תאריך אקראי בין 90 ל-16 יום אחורה.
  const daysAgo = 16 + Math.floor(Math.random() * 74);
  const dateMs = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const endMs = Math.min(Date.now(), dateMs + CHECK_WINDOW_MS);

  const klines = await fetchKlines(symbol, dateMs, endMs);
  if (!klines.length) throw new Error(`אין נתוני מחיר עבור ${symbol}`);

  const entry = parseFloat(klines[0][1]);
  const direction = Math.random() < prof.longBias ? 'LONG' : 'SHORT';
  const tpPct = Math.max(0.006, prof.tpCenter + rand(-0.006, 0.006));
  const slPct = Math.max(0.006, prof.slCenter + rand(-0.006, 0.006));
  const tp = direction === 'LONG' ? entry * (1 + tpPct) : entry * (1 - tpPct);
  const sl = direction === 'LONG' ? entry * (1 - slPct) : entry * (1 + slPct);

  const outcome = evaluateOutcome(klines, { direction, entry, tp, sl });

  return {
    id: newLeadId(),
    provider,
    asset: symbol,
    direction,
    entry: +entry.toFixed(2),
    tp: +tp.toFixed(2),
    sl: +sl.toFixed(2),
    dateMs,
    status: outcome.result,
    reason: outcome.reason,
    exitPrice: outcome.exitPrice,
    closedAtMs: outcome.closedAtMs,
    checkedAt: Date.now(),
    auto: true,
  };
}

/**
 * מאסף אוטומטי: יוצר ובודק perProvider לידים לכל אחד מ-10 הספקים.
 * onLead(lead)         — נקרא לכל ליד שהושלם (לעדכון UI מצטבר ושמירה ל-DB).
 * onProgress(done,tot) — התקדמות.
 * shouldStop()         — מאפשר עצירה יזומה.
 * concurrency          — מספר בקשות במקביל (ברירת מחדל 4, ידידותי למגבלות Binance).
 */
export async function runAutoScan({ perProvider = 24, onLead, onProgress, shouldStop, concurrency = 4 } = {}) {
  // בונה רשימת משימות (ספק לכל ליד), מעורבב כדי לפזר עומס בין נכסים/ספקים.
  const tasks = [];
  for (const provider of TGM_PROVIDERS) {
    for (let i = 0; i < perProvider; i++) tasks.push(provider);
  }
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  const total = tasks.length;
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      if (shouldStop && shouldStop()) return;
      const provider = tasks[idx++];
      try {
        const lead = await generateAndCheckLead(provider);
        onLead && (await onLead(lead));
      } catch {
        // מדלג על ליד שנכשל (חוסר נתון/רשת) — לא עוצר את המאסף.
      }
      done++;
      onProgress && onProgress(done, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  return done;
}
