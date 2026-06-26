/**
 * HeatmapEngine — the core liquidity heatmap matrix (time × price).
 *
 * Each "column" is a snapshot of order-book depth at one instant, binned by
 * price into `rows` buckets. Columns are kept in a ring buffer and scroll left
 * over time. Cell intensity = resting liquidity (qty) at that price level,
 * straight from OrderBookState — i.e. the real book. A bright persistent band
 * = a real resting whale order; it vanishes the instant that order is pulled.
 *
 * Vertical price window is fixed and re-centres (clearing history) only when
 * price drifts out of the central band, so price↔row mapping stays simple.
 */
export default class HeatmapEngine {
  constructor({ rows = 240, maxCols = 360, halfSpanPct = 0.01 } = {}) {
    this.rows = rows;
    this.maxCols = maxCols;
    this.halfSpanPct = halfSpanPct;     // vertical zoom: ± this fraction of mid
    this.pMin = 0;
    this.pMax = 0;
    this.columns = [];                  // ring of Float32Array(rows)
    this.maxIntensity = 0;              // smoothed normaliser
    this.lastMid = null;
    this.generation = 0;                // bumps on clear → renderer wipes buffer
  }

  hasRange() { return this.pMax > this.pMin; }

  setRangeFromMid(mid) {
    if (!mid || mid <= 0) return;
    this.pMin = mid * (1 - this.halfSpanPct);
    this.pMax = mid * (1 + this.halfSpanPct);
    this.lastMid = mid;
  }

  setZoom(halfSpanPct) {
    this.halfSpanPct = halfSpanPct;
    if (this.lastMid) this.setRangeFromMid(this.lastMid);
    this.clear();
  }

  /** Re-centre (and wipe history) when mid leaves the central 50% of the window. */
  maybeRecenter(mid) {
    if (!this.hasRange()) { this.setRangeFromMid(mid); return true; }
    const span = this.pMax - this.pMin;
    const lo = this.pMin + span * 0.25;
    const hi = this.pMax - span * 0.25;
    if (mid < lo || mid > hi) {
      this.setRangeFromMid(mid);
      this.clear();
      return true;
    }
    this.lastMid = mid;
    return false;
  }

  priceToRow(price) {
    if (!this.hasRange()) return -1;
    const f = (this.pMax - price) / (this.pMax - this.pMin);
    if (f < 0 || f >= 1) return -1;
    return Math.floor(f * this.rows);
  }

  rowToPrice(row) {
    if (!this.hasRange()) return null;
    const f = (row + 0.5) / this.rows;
    return this.pMax - f * (this.pMax - this.pMin);
  }

  /** Append one column built from the current order book. */
  pushColumn(book) {
    if (!this.hasRange()) return;
    const col = new Float32Array(this.rows);
    const { bids, asks } = book.levelsInRange(this.pMin, this.pMax);
    let colMax = 0;
    for (const lv of bids) {
      const r = this.priceToRow(lv.price);
      if (r >= 0) { col[r] += lv.qty; if (col[r] > colMax) colMax = col[r]; }
    }
    for (const lv of asks) {
      const r = this.priceToRow(lv.price);
      if (r >= 0) { col[r] += lv.qty; if (col[r] > colMax) colMax = col[r]; }
    }
    // Smooth normaliser: rise fast, decay slow → stable colours.
    this.maxIntensity = Math.max(colMax, this.maxIntensity * 0.995);
    this.columns.push(col);
    if (this.columns.length > this.maxCols) this.columns.shift();
  }

  clear() {
    this.columns = [];
    this.maxIntensity = 0;
    this.generation++;
  }
}
