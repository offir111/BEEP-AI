// api/_marketClock.js — שעון שוק וול-סטריט (ET). helper (underscore = לא route).
// ────────────────────────────────────────────────────────────────────────────
// קובע אם השוק האמריקאי פתוח *עכשיו*, מזהה ימי מסחר/חגים, ומחזיר את הסשן.
// כל החישוב באזור הזמן America/New_York (מטפל אוטומטית ב-DST דרך toLocaleString).
// שים לב: פתיחת המסחר בארה"ב = שעות הערב בישראל (16:30 חורף / 16:30 קיץ ביחס ל-ET).
// ────────────────────────────────────────────────────────────────────────────

// חגי בורסה אמריקאיים (NYSE) 2025–2026 — ימים שבהם השוק *סגור* לגמרי.
const HOLIDAYS = new Set([
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
]);

// מחזיר את רכיבי הזמן ב-ET עבור חותמת זמן נתונה (ברירת מחדל: עכשיו).
function etParts(date = new Date()) {
  // en-CA נותן YYYY-MM-DD; שעה ב-24h.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // en-CA לעיתים מחזיר 24 בחצות
  const minute = parseInt(parts.minute, 10);
  const weekday = parts.weekday; // 'Mon'...'Sun'
  return { ymd, hour, minute, weekday, minutes: hour * 60 + minute };
}

export function isTradingDay(date = new Date()) {
  const { ymd, weekday } = etParts(date);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  if (HOLIDAYS.has(ymd)) return false;
  return true;
}

// סשן השוק: 'pre' (4:00–9:30) · 'regular' (9:30–16:00) · 'after' (16:00–20:00) · 'closed'
export function marketSession(date = new Date()) {
  if (!isTradingDay(date)) return 'closed';
  const { minutes } = etParts(date);
  const OPEN = 9 * 60 + 30, CLOSE = 16 * 60, PRE = 4 * 60, AFTER = 20 * 60;
  if (minutes >= OPEN && minutes < CLOSE) return 'regular';
  if (minutes >= PRE && minutes < OPEN) return 'pre';
  if (minutes >= CLOSE && minutes < AFTER) return 'after';
  return 'closed';
}

// השוק פתוח למסחר רגיל עכשיו?
export function isMarketOpen(date = new Date()) {
  return marketSession(date) === 'regular';
}

// תאריך מסחר נוכחי ב-ET (YYYY-MM-DD) — מפתח ה"יום" לפתיחת פוזיציות.
export function etTradingDay(date = new Date()) {
  return etParts(date).ymd;
}

export function clockStatus(date = new Date()) {
  const { ymd, hour, minute, weekday } = etParts(date);
  return {
    etDate: ymd, etTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    weekday, session: marketSession(date), isOpen: isMarketOpen(date), isTradingDay: isTradingDay(date),
  };
}
