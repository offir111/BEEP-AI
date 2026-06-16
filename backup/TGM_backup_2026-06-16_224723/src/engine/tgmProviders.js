// TGM — סורק לידים: ספקים חיים בלבד.
// כל ספק כאן חייב מקור חי אמיתי (ערוץ טלגרם ציבורי חינמי שניתן לקצור ממנו
// entry/TP/SL באופן שיטתי). הרשימה חייבת לשקף את TELEGRAM_CHANNELS שב-api/_tgmTelegram.js.
// כדי להוסיף ספק — הוסף ערוץ שם, והוסף את שם הספק כאן.

export const LIVE_PROVIDERS = [
  'CryptoSignals.org',    // @cryptosignals — entry/TP/SL מלאים בערוץ החינמי (~20K)
  'Crypto Signal Farmers', // @CryptoSignalFarmers — Entry/TP1../Stop Loss מובנה (~7K)
];

// מינימום טריידים שמזכה ספק בדירוג רשמי.
export const MIN_TRADES_FOR_RANK = 20;

// חלון בדיקה מקסימלי לכל ליד (14 יום) במ"ש.
export const CHECK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
