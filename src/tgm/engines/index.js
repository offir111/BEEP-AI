// TGM · רישום מנועי הלידים — נקודה אחת להוספה/הסרה של מנועים.
// כל מנוע מממש את הממשק האחיד (ראה baseEngine.js).
// כדי להוסיף מנוע: לכתוב קובץ מנוע חדש ולהוסיף אותו למערך כאן.

import MomentumEngine from './MomentumEngine';
import BreakoutEngine from './BreakoutEngine';
import CatalystEngine from './CatalystEngine';
import MnaEngine from './MnaEngine';

export const ENGINES = [MomentumEngine, BreakoutEngine, CatalystEngine, MnaEngine];

export const ENGINE_BY_KEY = Object.fromEntries(ENGINES.map((e) => [e.key, e]));

export function getEngine(key) {
  return ENGINE_BY_KEY[key] || null;
}
