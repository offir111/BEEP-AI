/**
 * offirConviction.js — שכבת הביטחון + מנוע ההמלצה של +OFFIR (שלב 3).
 *
 * מחבר את הדאטה האמיתי (Finviz: Recom/Inst-Own/Rel-Volume/News, מ-offir-quote)
 * עם הניתוח הטכני (analyzeOffir משלב 1) לכדי:
 *   1. באדג'י ביטחון (ווליום / אנליסטים / מוסדיים / קטליסט)
 *   2. זיהוי קטליסט שמרני מכותרות חדשות
 *   3. המלצה: STRONG BUY / BUY / המתן / MIX / זהירות
 *
 * טהור לחלוטין — נבדק headless. כלל-על: בטיחות (טכני שבור) גוברת על קטליסט חיובי.
 */

export const CONVICTION = {
  REL_VOL_HOT: 2,      // נפח יחסי ≥ → ווליום חריג
  ANALYST_BUY: 2,      // Recom ≤ 2 → Buy/Strong-Buy
  INST_HIGH: 50,       // אחזקה מוסדית % ≥ → "גבוהה"
};

/* ── קטליסט מכותרות (Part C) — שמרני: עדיף לפספס מאשר להתריע שווא ── */
const STRONG_VERBS = [
  'acquired', 'acquires', 'to acquire', 'acquisition',
  'partnership', 'partners with', 'stake', 'invests', 'investment',
  'merger', 'merges', 'contract awarded', 'awarded contract', 'wins contract', 'deal with',
];
const GIANTS = [
  'nvidia', 'nvda', 'google', 'alphabet', 'microsoft', 'msft',
  'amazon', 'aws', 'spacex', 'apple', 'meta', 'openai', 'oracle', 'broadcom',
];
const VAGUE = [
  'considering', 'in talks', 'talks to', 'rumored', 'rumor', 'may ', 'might ',
  'could ', 'weighs', 'weighing', 'reportedly', 'potential', 'potentially',
  'exploring', 'mulls', 'plans to', 'eyeing', 'seeks',
];

const includesAny = (hay, arr) => arr.find(w => hay.includes(w)) || null;

/**
 * detectCatalystHeadline — עובר על הכותרות ומחזיר:
 *   { strong, strongHeadline, verb, giant, latest }
 * strong=true רק אם כותרת מכילה פועל-עסקה ודאי + שם ענק מזוהה ואינה מעורפלת.
 */
export function detectCatalystHeadline(headlines) {
  const arr = Array.isArray(headlines) ? headlines : [];
  const latest = arr.length ? arr[0] : null;
  for (const h of arr) {
    const title = (h?.title || '').toLowerCase();
    if (!title) continue;
    if (includesAny(title, VAGUE)) continue;               // מעורפל → לא חזק
    const verb = includesAny(title, STRONG_VERBS);
    const giant = includesAny(title, GIANTS);
    if (verb && giant) {
      return { strong: true, strongHeadline: h, verb, giant, latest };
    }
  }
  return { strong: false, strongHeadline: null, verb: null, giant: null, latest };
}

/* ── באדג'י ביטחון (Part B) — כל אחד ירוק רק על דאטה אמיתי ── */
export function convictionBadges(q, catalystStrong = false, cfg = CONVICTION) {
  const relVolume = num(q?.relVolume);
  const analyst   = num(q?.analystRecom);
  const instOwn   = num(q?.instOwn);

  return {
    volume: {
      on: relVolume != null && relVolume >= cfg.REL_VOL_HOT,
      value: relVolume, known: relVolume != null,
    },
    analyst: {
      on: analyst != null && analyst <= cfg.ANALYST_BUY,
      value: analyst, target: num(q?.targetPrice), known: analyst != null,
    },
    institutional: {
      on: instOwn != null && instOwn >= cfg.INST_HIGH,
      value: instOwn, known: instOwn != null,
    },
    catalyst: {
      on: !!catalystStrong,
      known: Array.isArray(q?.headlines) && q.headlines.length > 0,
    },
  };
}

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

/* ── מנוע ההמלצה (Part D) ── */
export const RECO = {
  STRONG_BUY: { level: 'strong_buy', label: 'STRONG BUY', color: 'green',  dcaOk: true,  conviction: 'גבוהה' },
  BUY:        { level: 'buy',        label: 'BUY',         color: 'blue',   dcaOk: false, conviction: 'בינונית' },
  WAIT:       { level: 'wait',       label: 'המתן לאישור טכני', color: 'yellow', dcaOk: false, conviction: null },
  MIX:        { level: 'mix',        label: 'MIX', color: 'gray',   dcaOk: false, conviction: null },
  CAUTION:    { level: 'caution',    label: 'זהירות', color: 'red',    dcaOk: false, conviction: null },
};

/**
 * recommend — משלב [ביטחון/קטליסט] × [טכני] להמלצה סופית.
 * כלל-על: טכני שבור (🔴/שבירת תעלה/מתחת SMA200) → זהירות, גם עם קטליסט חיובי.
 *
 * @param {object} p
 * @param {object} p.analysis  תוצאת analyzeOffir (status/brokeBelow/criteria)
 * @param {object} p.badges    convictionBadges(...)
 * @param {boolean} p.catalystStrong
 */
export function recommend({ analysis, badges, catalystStrong = false } = {}) {
  if (!analysis) return { ...RECO.MIX, reason: 'אין נתוני ניתוח' };

  const techBroken = analysis.status === 'red' || analysis.brokeBelow === true;
  const techEntry  = analysis.status === 'green';   // מגמה עולה תקפה + נקודת כניסה
  const techWait   = analysis.status === 'yellow';  // מגמה עולה, לא בכניסה

  const analyst = !!badges?.analyst?.on;
  const inst    = !!badges?.institutional?.on;
  const volume  = !!badges?.volume?.on;
  const backingCount = [analyst, inst, volume, catalystStrong].filter(Boolean).length;
  const strongBacking = catalystStrong || (analyst && inst && volume);

  // 1) בטיחות גוברת — טכני שבור = זהירות, תמיד.
  if (techBroken) {
    const note = (catalystStrong || backingCount >= 2)
      ? 'קטליסט/גב חיובי אך הטכני שבור — אמת לפני DCA'
      : 'שבירת מגמה טכנית — אמת לפני DCA';
    return { ...RECO.CAUTION, reason: note, backingCount, strongBacking };
  }

  // 2) STRONG BUY — גב חזק + טכני בנקודת כניסה.
  if (techEntry && strongBacking) {
    return {
      ...RECO.STRONG_BUY, backingCount, strongBacking,
      reason: catalystStrong ? 'קטליסט חזק + כניסה טכנית — ודאות גבוהה' : 'גב אנליסטים+מוסדיים+נפח + כניסה טכנית',
    };
  }

  // 3) BUY — כניסה טכנית עם גב חיובי כלשהו.
  if (techEntry && backingCount >= 1) {
    return { ...RECO.BUY, backingCount, strongBacking, reason: 'כניסה טכנית עם גב חיובי חלקי' };
  }

  // 4) המתן — יש גב, אבל המחיר לא בנקודת כניסה (אמצע/עליון תעלה).
  if (techWait && backingCount >= 1) {
    return { ...RECO.WAIT, backingCount, strongBacking, reason: 'גב חיובי קיים, אך המחיר לא בנקודת כניסה' };
  }

  // 5) ברירת מחדל — אותות לא-מובהקים/סותרים → MIX.
  return {
    ...RECO.MIX, backingCount, strongBacking,
    reason: backingCount === 0 ? 'אין גב חיצוני מובהק — תשקול בעצמך' : 'אותות מעורבים — אין הכרעה',
  };
}
