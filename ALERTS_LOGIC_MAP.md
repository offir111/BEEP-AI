# ALERTS_LOGIC_MAP.md
## Step 1 — S.T.B Alerts Functional Map
## Step 2 — beep-ai Bug Table

Source: `C:\Users\Admin\Downloads\S.T.B\live\index-BrRuZL4L-v104.js` (READ ONLY)

---

## FEATURE MAP

### 1. Asset Slot Buttons (fixed + custom)
- **Fixed slots**: localStorage `stb_fixed_slots`, default `['BTC','ETH','SOL','SPY','NVDA','GLD']`
- **Custom slots**: localStorage `stb_custom_slots`, default 6 empty strings
- **Click (normal mode)**: `ve(symbol)` → sets active symbol, clears input, clears edit, fetches new live price via `P(symbol)`, calls `onSymbolChange` prop
- **Click (edit mode)**: opens inline text editor to rename that slot
- **Slot save**: updates localStorage key directly, closes editor

### 2. Gainers / Top-Movers Tabs
- **Source**: Props `cryptoGainers` (top 3) + `stockGainers` (top 3) passed by parent
- **Each item**: `{ symbol, changePercent }` → displayed as `SYM +X.X%` colored green/red
- **Click**: calls `ve(sym)` — same as slot button click (switches symbol + fetch price)

### 3. Duration Buttons (D / Y)
- **D** = `'eod'` → expiresAt = next 4:00 PM America/New_York
- **Y** = `'year'` → expiresAt = `Date.now() + 365×86400000`
- Default: `'year'`

### 4. Live Price Display + Fill Button
- **Source**: parent-provided `currentPrice` prop, updated by parent polling / WS
- **Click**: fills input with `price < 1 ? toFixed(6) : toFixed(2)`, sets direction to 'above'

### 5. % Offset Row (SL / TP)
- **TP button**: `target = livePrice × (1 + pct/100)`, direction = 'above'
- **SL button**: `target = livePrice × (1 - pct/100)`, direction = 'below'
- **Previews**: computed inline, no button needed

### 6. Price Input + ▲▼ Arrows
- **Step sizes**: `<1→±0.001 (4dp)`, `<100→±0.01 (2dp)`, `<1000→±1`, `≥1000→±10`
- **Hold-repeat**: immediate step → 380ms delay → 70ms interval; cleared on mouseUp/mouseLeave/touchEnd
- **Auto-direction**: if typed price < livePrice → 'below'; else 'above'

### 7. Direction Badge (↑ TARGET / ↓ STOP)
- **Auto-detect on type**: `typedPrice < livePrice → 'below'`
- **Manual toggle**: click toggles between 'above'/'below'
- **Color**: 'below' = red `#f87171`, 'above' = gold `#fbbf24`

### 8. Alert Object Shape (S.T.B)
```
{
  id:            `${Date.now()}-${Math.random()}`,
  symbol:        string,
  targetPrice:   number,
  direction:     'above' | 'below',
  triggered:     false,
  created:       number (ms),
  isC:           boolean (is Binance-tradeable crypto),
  duration:      'eod' | 'year',
  expiresAt:     number | null
}
```

### 9. "+ הוסף" Button
- Calls alert factory → appends to localStorage `stb_alerts` + state
- **Duplicate check**: NONE in S.T.B (every call appends)
- Clears input; stays open

### 10. "▶ START" Button
- Same as הוסף but also calls `onClose('start')` → parent closes dialog
- If input empty, just closes

### 11. "נקה SYM" / "נקה הכל"
- Show confirm overlay (single confirm, no double-click)
- On confirm: `onClearSym(activeSymbol)` / `onClearAll()`
- `onClearSym`: removes all alerts where `alert.symbol === activeSymbol`
- `onClearAll`: removes all alerts

### 12. Alert Strip (bottom row)
- **Filter**: `symbol === activeSymbol && !triggered && !isPreview`
- **Item click**: loads alert into edit form (`enterEdit(a)`) — does NOT switch symbol
- **× button**: removes that specific alert
- **Item format**: `● price.toFixed(2)` (dot colored by direction)
- **No max limit** in S.T.B

### 13. Bell Counter
- In dialog: count of active (non-triggered) alerts for current symbol
- In nav: count across all symbols, dispatched via `CustomEvent('alertBadgeUpdate')`

### 14. Trigger Logic
- **Polling**: every 5s via `/api/tv-prices`
- **Crypto WS**: Binance `24hrMiniTicker` WebSocket (real-time)
- **above**: `price >= targetPrice` → triggered
- **below**: `price <= targetPrice` → triggered
- On trigger: sound (3× 880Hz), OS notification, toast for 9s

---

## STEP 2 — BUG TABLE (beep-ai vs S.T.B)

| # | Element | S.T.B Behavior | beep-ai Bug | Fix |
|---|---------|---------------|-------------|-----|
| 1 | **Strip item click** | Loads alert into edit form (`enterEdit`) — does NOT switch symbol | Called `selectSymbol(a.symbol)` — switches symbol instead of editing | ✅ FIXED: now calls `enterEdit(a)` |
| 2 | **Strip filter** | Only active non-triggered alerts for CURRENT symbol | Showed all alerts across all symbols (`alerts.slice(0,10)`) | ✅ FIXED: filtered to `activeAlerts` (current symbol, non-triggered) |
| 3 | **Strip price format** | `toFixed(6)` for sub-1 prices, `toFixed(2)` otherwise; no symbol prefix | Showed symbol prefix + `toLocaleString(maxFrac:2)` (wrong for sub-1) | ✅ FIXED: uses `getStep(a.target).dec` for correct precision |
| 4 | **Strip editing highlight** | Editing alert shows highlighted | No visual feedback when editing from strip | ✅ FIXED: `--editing` class on active edit item |
| 5 | **enterEdit price format** | `targetPrice < 1 ? toFixed(6) : toFixed(2)` | `String(a.target)` — raw float, no formatting | ✅ FIXED: uses `getStep(a.target).dec` |
| 6 | **Duplicate alert feedback** | N/A (S.T.B has no dedup) | `addAlert()` returns null silently; user sees nothing | ✅ FIXED: input flashes red with `--dup` class for 900ms |
| 7 | **Notification permission** | Managed by S.T.B auth/push system | `fireNotification()` guarded on `'granted'` but never requested | ✅ FIXED: `requestPermission()` called on first successful add |
| 8 | **Gainers tabs** | Parent passes `cryptoGainers` + `stockGainers` props | Props default to `[]`; no parent passes them; tabs row never renders | ✅ FIXED: self-fetch from Binance 24hr API on mount |
| 9 | **handleAdd edit flow** | Clears input after edit-save | Input not cleared after `editAlert()` call | ✅ FIXED: `setInputVal('')` in edit branch |

---

## STEP 3 — Fixes Applied

All 9 bugs fixed in `src/components/QuickAlert.jsx` + `src/components/QuickAlert.css`.
Build: ✅ 0 errors.

Key changes:
- Strip: `activeAlerts` (current sym, non-triggered) with `enterEdit(a)` on click
- enterEdit: `a.target.toFixed(getStep(a.target).dec)` for correct precision
- handleAdd/handleStart: check `addAlert()===null` → dupFlash
- handleStart edit branch: fixed missing `setInputVal('')`
- Notification permission: `Notification.requestPermission()` on first add
- Gainers: `selfGainers` state + Binance 24hr fetch on mount
- CSS: `.sa-alert-input.--dup` flash animation + `.sa-alert-strip-item.--editing` highlight
