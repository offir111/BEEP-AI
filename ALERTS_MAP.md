# ALERTS_MAP.md — מיפוי תיבת ההתראות

## שלב 1 – מיפוי המקור (S.T.B / "beep beep")

### מיקום הקוד
הקוד נמצא ב-bundle מקומפל:
- `live/index-BrRuZL4L-v104.js` (766KB)
- `may24_bundle_decoded.js` (653KB) — זהה

### קומפוננטת ה-Alert Dialog (minified: `dl`)

**Signature:**
```js
function dl({ symbol, currentPrice, alerts, onAdd, onRemove, onClearSym, onClearAll,
               onClose, onSymbolChange, onPriceChange, stockGainers, cryptoGainers })
```

### מבנה ה-JSX

```
sa-alert-overlay (click-away → סגור)
  sa-alert-sym-overlay (פאנל בחירת סמל — אופציונלי)
    sa-alert-sym-panel
      sa-alert-sym-panel-hdr (כותרת + "ערוך" + ✕)
      sa-alert-sym-search-wrap (חיפוש + "הוסף")
      sa-alert-sym-picker-grid (כל סמלי ה-watchlist)
  sa-alert-dialog
    sa-alert-top
      sa-alert-hdr
        sa-alert-sym-big (הסמל הנוכחי)
        sa-alert-hdr-actions ("ערוך" toggle + ✕ סגור)
      sa-alert-quick-tabs (3 gainers קריפטו + 3 מניות עם %)
      sa-alert-shortcuts (6 fixed slots — שורה 1)
      sa-alert-shortcuts.sa-alert-custom-slots (6 custom slots — שורה 2, ריק = "+")
      sa-alert-ctrl-panel
        sa-alert-dur-corner
          "☰ בחר מניה" (פותח sym picker)
          sa-alert-dur-group → D (eod) + Y (year)
        sa-alert-current-btn (מחיר נוכחי, לחיצה → ממלא input)
        sa-alert-form
          bell SVG + "התראה"
          input.sa-alert-input (number, dir=ltr)
          sa-alert-arrows (▲/▼ עם hold-repeat)
          sa-alert-add-btn (+ הוסף / ✓ עדכן)
          sa-alert-cancel-edit (ביטול — בעריכה בלבד)
    sa-alert-bottom
      sa-clearall-confirm-overlay (confirm "נקה [symbol]")
      sa-clearall-confirm-overlay (confirm "נקה הכל")
      sa-alert-footer
        sa-alert-apply-btn → START
        sa-alert-clear-sym-btn → "נקה [symbol]"
        sa-alert-clear-all-btn → "נקה הכל"
      sa-alert-strip (רשימת התראות לסמל הנוכחי)
        sa-alert-strip-item (×N)
          ● dot (אדום=מתחת, צהוב=מעל)
          $X.XX
          ✕ מחיקה
```

### כפתורי נכסים (slots)

**Fixed slots (שורה 1):** `['BTC', 'ETH', 'SOL', 'SPY', 'NVDA', 'GLD']`
localStorage key: `stb_fixed_slots`

**Custom slots (שורה 2):** 6 slots ריקים, ריק מוצג כ-"+", לחיצה → פתח sym picker
localStorage key: `stb_custom_slots`

**Quick-tab gainers (שורה עליונה — דינמי):** עד 3 gainers קריפטו + 3 מניות עם שינוי %
CIFR, HUT, RIOT, MARA, CLSK מופיעות אם הן בין ה-gainers

**Watchlist מלא (grid בחירת סמל):**
`['BTC', 'ETH', 'SOL', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'SPY', 'GLD']`
localStorage key: `stb_watchlist`

### כפתורי D / Y (תוקף)

- `D` = `eod` — עד 4:00 PM ET ("עד תום המסחר")
- `Y` = `year` — +365 יום
- ברירת מחדל: `year`

### שדה מחיר + חצים ▲▼ (hold-repeat)

- `input.sa-alert-input`, type=number, dir=ltr, step=0.01, min=0
- **צעד:** <1 → +0.001 | <100 → +0.01 | <1000 → +1 | אחרת → +10
- **Hold-repeat:** לחיצה ראשונה מיידית, לאחר 380ms → חזרה כל 70ms
- תמיכה ב-mouse + touch
- Enter → add
- לחיצה על מחיר נוכחי → ממלא input

### כפתור "הוסף +" / "עדכן"

- מצב רגיל: `+ הוסף`
- מצב עריכה: `✓ עדכן` + כפתור "ביטול"
- יוצר אובייקט alert דרך `Y(price)` ומפעיל `onAdd`

### כפתורי START / נקה

**START (`sa-alert-apply-btn`):**
- מוסיף alert + סוגר dialog מיידית (ללא delay)
- במצב עריכה: מפעיל `onPriceChange` במקום `onAdd`

**"נקה [symbol]" + "נקה הכל":**
- מציגים confirm overlay בתוך ה-dialog
- confirm → מפעיל `onClearSym(symbol)` / `onClearAll()`

### רשימת ההתראות (strip)

- מוצגת בתחתית ה-dialog
- רק התראות לסמל הנוכחי שלא הופעלו
- כל שורה: ● צבעוני + $מחיר + ✕ מחיקה
- לחיצה על שורה → כניסה למצב עריכה
- צבעי dot: אדום `#f87171` = מתחת, צהוב `#fbbf24` = מעל

### מבנה אובייקט התראה (מקור)

```js
{
  id: `${Date.now()}-${Math.random()}`,
  symbol: string,
  targetPrice: number,
  direction: 'above' | 'below',
  triggered: boolean,
  created: number,
  isC: boolean,          // isCrypto
  duration: 'eod' | 'year',
  expiresAt: Date | null,
  triggeredAt: number | null,
  triggeredPrice: number | null,
}
```

### שמירה ב-localStorage (מקור)

| Key | תוכן |
|-----|------|
| `stb_alerts` | Alert[] ראשי |
| `stb_fixed_slots` | 6 fixed symbols |
| `stb_custom_slots` | 6 custom symbols |
| `stb_watchlist` | רשימת כל הסמלים |

### לוגיקת trigger

```js
if (direction === 'above' && currentPrice >= targetPrice) → triggered = true
if (direction === 'below' && currentPrice <= targetPrice) → triggered = true
```
בעת trigger: vibrate + 3-tone beep (880Hz) + OS notification + toast 9s

### מעקב מחיר

- WebSocket live mode: subscribe לכל סמל עם alert פעיל → trigger על כל tick
- Polling fallback: setInterval כל **5 שניות** → `/api/tv-prices`

---

## שלב 2 – מיפוי היעד (beep-ai)

### קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `src/context/AlertsContext.jsx` | מאגר state, localStorage, price loop, sound, OS notif |
| `src/pages/AlertsPage.jsx` | עמוד ניהול מלא: form + רשימת cards |
| `src/pages/AlertsPage.css` | עיצוב עמוד ההתראות |
| `src/components/AlertBanner.jsx` | toast overlay קבוע בראש המסך |
| `src/components/AlertLine.jsx` | קו מחיר גרירה על גרף TradingView |
| `src/components/QuickAlert.jsx` | modal מהיר מדף הגרפים |
| `src/components/QuickAlert.css` | עיצוב QuickAlert modal |
| `src/components/Header.jsx` | פעמון עם badge מונה |

### מבנה אובייקט התראה (beep-ai)

```js
{
  id: string,
  symbol: string,
  direction: 'above' | 'below',
  target: number,          // שם שדה שונה מהמקור (targetPrice → target)
  duration: 'forever' | 'eod' | 'year',
  expiresAt: number | null,
  note: string,
  triggered: boolean,
  triggeredAt: number | null,
  triggeredPrice: number | null,
  expiredOut: boolean | undefined,
  created: number,
  seen: boolean,
}
```

### שמירה ב-localStorage (beep-ai)

| Key | תוכן |
|-----|------|
| `beepai_alerts` | Alert[] ראשי |
| `beepai_tech_alerts` | תמיד [] (לא בשימוש) |
| `beepai_fixed_slots` | 6 fixed symbols |
| `beepai_custom_slots` | 6 custom symbols |

---

## טבלת השוואה (diff) — מקור vs יעד

| פיצ'ר | מקור (S.T.B) | beep-ai לפני תיקון | beep-ai אחרי תיקון |
|--------|-------------|-------------------|-------------------|
| Hold-repeat על ▲▼ | ✅ 70ms אחרי 380ms delay | ❌ click בלבד | ✅ **נוסף** |
| כפתור START | ✅ מוסיף + סוגר מיידית | ❌ אין | ✅ **נוסף ל-QuickAlert** |
| "נקה [symbol]" בתיבה | ✅ עם confirm | ❌ clearSymbol() קיים ב-context, ללא UI | ✅ **נוסף ל-QuickAlert** |
| "נקה הכל" בתיבה | ✅ עם confirm | ❌ clearAll() קיים ב-context, ללא UI | ✅ **נוסף ל-QuickAlert + AlertsPage** |
| Confirm overlays | ✅ בתוך ה-dialog | ❌ אין | ✅ **נוסף בשתי תיבות** |
| עריכת כיוון+תוקף+הערה | ✅ | ❌ עריכה שינתה target בלבד | ✅ **editAlert עודכן לקבל object** |
| Polling interval | 5 שניות | 30 שניות | ✅ **עודכן ל-5 שניות** |
| unseenFired badge | — | מחושב, לא מוצג | ✅ **dot כתום פועם ב-Header** |
| markSeen() | — | לא נקרא | ✅ **נקרא בטעינת AlertsPage** |
| בורר נכסים | fixed+custom slots + gainers tabs | fixed+custom slots (ב-QuickAlert) | ✅ קיים |
| מחיר חי | ✅ | ✅ | ✅ |
| כפתור "השתמש" במחיר | ✅ | ✅ | ✅ |
| auto-detect direction | ✅ | ✅ | ✅ |
| TARGET/STOP LOSS badge | ✅ | ✅ | ✅ |
| כפתורי duration D/Y | D+Y | forever/eod/year | ✅ (ממשק שונה, פונקציה זהה) |
| רשימת התראות strip | לסמל הנוכחי בתחתית | alert chips ב-QuickAlert | ✅ קיים |
| נקודה צבעונית | אדום/צהוב | status dot ירוק (פעיל) | ✅ קיים (עיצוב שונה) |
| מחיקה בודדת ✕ | ✅ | ✅ | ✅ |
| localStorage persistence | ✅ | ✅ | ✅ |
| Sound + vibrate | ✅ 3-tone 880Hz | ✅ זהה | ✅ |
| OS notifications | ✅ | ✅ | ✅ |
| Toast banner | ✅ 9s | ✅ 9s | ✅ |
| AlertLine על גרף | ✅ | ✅ (אומדן בלבד) | ✅ |
| CSV export | — | ✅ | ✅ |
| filter all/active/triggered | — | ✅ | ✅ |
| reset triggered alert | — | ✅ | ✅ |

---

## שלב 3 – שינויים שבוצעו

### 1. `AlertsContext.jsx`
- **editAlert** מקבל עכשיו object `{ target?, direction?, duration?, note? }` (תאימות לאחור: מספר עדיין עובד)
- **polling interval** הופחת מ-30s ל-5s

### 2. `QuickAlert.jsx`
- ייבוא `useRef`, `clearSymbol`, `clearAll`
- `holdRef` — ref לניהול timers של hold-repeat
- `stepStart(dir)` / `stepEnd()` — hold-repeat על ▲▼ (70ms אחרי 380ms)
- `handleStart()` — מוסיף alert + סוגר modal מיידית
- `editAlert(editId, { target, direction, duration, note })` — עריכה מלאה
- כפתורי `▶ START`, `נקה [symbol]`, `נקה הכל` — footer חדש
- confirm overlays לשתי פעולות המחיקה

### 3. `AlertsPage.jsx`
- ייבוא `useRef`, `clearAll`, `markSeen`
- `holdRef` ב-AlertForm — hold-repeat על ▲▼
- `handleSave` מעביר `{ target, direction, duration, note }` ל-editAlert
- `useEffect(() => markSeen(), [markSeen])` — מסמן הכל "נראה" בכניסה לעמוד
- כפתור 🗑 **נקה הכל** ב-header עם confirm overlay

### 4. `Header.jsx`
- `unseenFired` מ-context
- `.hdr-bell-fired` — נקודה כתומה פועמת כשיש התראות שהופעלו ולא נראו

### 5. CSS Files
- `QuickAlert.css` — `.qa-footer`, `.qa-start-btn`, `.qa-clear-sym-btn/all`, `.qa-confirm-*`, `qa-card position:relative`
- `AlertsPage.css` — `.al-clearall-btn`, `.al-confirm-*`
- `Header.css` — `.hdr-bell-fired` + animation `fired-pulse`
