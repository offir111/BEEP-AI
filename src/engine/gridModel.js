/**
 * gridModel.js — local grid-bot geometry, centered on the LIVE price.
 *
 * Why this exists: Model GRID used to render `lower`/`upper`/`apr` verbatim from an
 * external GitHub JSON produced by an offline bot. When that JSON goes stale the page
 * showed levels far from the live price (e.g. 73,160–81,906 while BTC ~65,000) and
 * APR 0.00%. This module recomputes a coherent grid **centered on the current price**
 * (ATR- or percentage-based spacing) and an APR figure, so the panel is never broken.
 *
 * Pure functions — unit-tested headlessly (see scripts/test-grid.mjs).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build a grid centered on `price`.
 *
 * @param {number} price        current live price
 * @param {object} [opts]
 * @param {number} [opts.levels=12]      number of grid levels
 * @param {number} [opts.bandPct=0.06]   half-band as a fraction of price (±6%) — used when no ATR
 * @param {number} [opts.atr]            ATR(14); when given, half-band = min(2·ATR, 12% of price)
 * @param {number} [opts.investment=1000] capital spread evenly across levels
 * @returns {null | {lower,upper,grids,atr14,step,investment,grid:Array,source:'local'}}
 */
export function buildCenteredGrid(price, opts = {}) {
  if (!Number.isFinite(price) || price <= 0) return null;

  const levels     = Math.max(2, Math.floor(opts.levels ?? 12));
  const investment = Number.isFinite(opts.investment) && opts.investment > 0 ? opts.investment : 1000;

  // Half-band: prefer ATR-based spacing, fall back to a percentage band. Cap at ±12%.
  const pctHalf  = price * (opts.bandPct ?? 0.06);
  const atrHalf  = Number.isFinite(opts.atr) && opts.atr > 0 ? opts.atr * 2 : null;
  const halfBand = Math.min(atrHalf ?? pctHalf, price * 0.12);

  const lower = price - halfBand;
  const upper = price + halfBand;
  const step  = (upper - lower) / levels;
  const perLevel = investment / levels;

  const grid = [];
  for (let i = 0; i < levels; i++) {
    const buy  = lower + step * i;
    const sell = buy + step;
    const qty  = buy > 0 ? perLevel / buy : 0;
    const profit = qty * (sell - buy);     // realized profit if this rung round-trips once
    // Rungs below the live price are considered "filled" (bought, waiting to sell).
    const filled = price >= sell;
    grid.push({
      buy,
      sell,
      qty: Number(qty.toFixed(6)),
      profit: Number(profit.toFixed(2)),
      filled,
    });
  }

  return {
    lower,
    upper,
    grids: levels,
    atr14: Number.isFinite(opts.atr) ? opts.atr : null,
    step,
    investment,
    grid,
    source: 'local',
  };
}

/**
 * Realized APR from actual bot performance.
 * @returns {number|null} annualized percent, or null if inputs insufficient.
 */
export function computeRealizedApr({ realizedPnl, investment, startMs, nowMs }) {
  if (!Number.isFinite(realizedPnl) || !Number.isFinite(investment) || investment <= 0) return null;
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || nowMs <= startMs) return null;
  const days = (nowMs - startMs) / MS_PER_DAY;
  if (days < 0.5) return null;                 // too little history to annualize meaningfully
  const periodReturn = realizedPnl / investment;
  return periodReturn * (365 / days) * 100;
}

/**
 * Theoretical APR from grid geometry, for when no realized bot data exists.
 * Conservative, DOCUMENTED assumption: the price fully oscillates the grid band
 * `ASSUMED_BAND_CYCLES_PER_YEAR` times per year, each oscillation capturing the band span.
 * Always returned with a `theoretical: true` flag so the UI can label it honestly.
 */
const ASSUMED_BAND_CYCLES_PER_YEAR = 6;  // ~once every two months, deliberately conservative
const THEORETICAL_APR_CAP = 80;          // never advertise an implausible figure

export function theoreticalApr(grid, price) {
  if (!grid || !Number.isFinite(price) || price <= 0) return null;
  const spanPct = ((grid.upper - grid.lower) / price) * 100;
  const apr = Math.min(spanPct * ASSUMED_BAND_CYCLES_PER_YEAR, THEORETICAL_APR_CAP);
  return Number(apr.toFixed(2));
}

/**
 * Decide whether the EXTERNAL grid data is usable (fresh + price in range), or whether
 * we should fall back to a locally-centered grid.
 * @returns {boolean} true if external data is coherent with the live price
 */
export function externalGridUsable(extGrid, price) {
  if (!extGrid || !Number.isFinite(price)) return false;
  const { lower, upper } = extGrid;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) return false;
  // Usable only if the live price sits inside (or very near) the stored band.
  const pad = (upper - lower) * 0.15;
  return price >= lower - pad && price <= upper + pad;
}
