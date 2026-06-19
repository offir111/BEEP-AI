// סטאב ל-@capacitor/core עבור בדיקות Node (אין WebView).
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
export default { Capacitor };
