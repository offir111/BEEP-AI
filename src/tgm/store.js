// TGM · Store — יצירה, הערכה ושמירה של לידים (localStorage).
// כל ליד נשמר כרשומה מובנית עם מזהה יציב (engineKey|symbol|day) למניעת כפילויות.

import { ENGINES } from './engines';
import { evaluateLead } from './evaluator';

const STORAGE_KEY = 'tgm_engine_leads_v1';

// ── קריאה/כתיבה ל-localStorage ─────────────────────────────────────────────
export function loadLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveLeads(leads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (e) {
    console.warn('[TGM] שמירת לידים נכשלה:', e.message);
  }
}

export function clearLeads() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function leadId(engineKey, symbol, timestamp) {
  return `${engineKey}|${symbol}|${timestamp}`;
}

// ── יצירה + הערכה ──────────────────────────────────────────────────────────
// מריץ את כל המנועים עבור יום נתון, מעריך כל ליד, ומחזיר רשומות מובנות.
export function generateRound(dateMs) {
  const records = [];
  for (const eng of ENGINES) {
    let leads = [];
    try {
      leads = eng.generateLeads(dateMs) || [];
    } catch (e) {
      console.warn(`[TGM] מנוע ${eng.key} נכשל ביצירה:`, e.message);
      continue;
    }
    for (const lead of leads) {
      const evaluated = evaluateLead(lead);
      records.push({
        id: leadId(eng.key, evaluated.symbol, evaluated.timestamp),
        engineKey: eng.key,
        source: evaluated.source,
        signalType: evaluated.signalType,
        symbol: evaluated.symbol,
        reason: evaluated.reason,
        timestamp: evaluated.timestamp,
        entry: evaluated.entry,
        exitPrice: evaluated.exitPrice,
        pnlPct: evaluated.pnlPct,
        status: evaluated.status,
        exitReason: evaluated.exitReason,
        error: evaluated.error,
        meta: evaluated.meta,
        evaluatedAt: evaluated.evaluatedAt,
      });
    }
  }
  return records;
}

// ממזג רשומות חדשות לתוך הקיימות (לפי id), שומר ומחזיר את המאוחד.
export function mergeAndSave(existing, fresh) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const r of fresh) byId.set(r.id, r); // הערכה חדשה דורסת ישנה לאותו ליד
  const merged = [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  saveLeads(merged);
  return merged;
}

// סבב יומי בודד (היום שניתן) → ממוזג ונשמר.
export function runDailyRound(dateMs) {
  const fresh = generateRound(dateMs);
  return mergeAndSave(loadLeads(), fresh);
}

// ── זריעת היסטוריה: N ימי מסחר אחרונים (מדלג סופ״ש) ──────────────────────────
// בונה היסטוריה כדי שיהיה מדגם מספק לסטטיסטיקה החודשית ולדירוג המנועים.
export function seedHistory(days = 30, endMs = Date.now()) {
  const existing = loadLeads();
  const all = [];
  let cursor = new Date(endMs);
  let added = 0;
  // הולך אחורה עד שנאספו `days` ימי מסחר.
  let guard = 0;
  while (added < days && guard < days * 2 + 10) {
    guard++;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      // לא שבת/ראשון
      const ts = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
      all.push(...generateRound(ts));
      added++;
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return mergeAndSave(existing, all);
}
