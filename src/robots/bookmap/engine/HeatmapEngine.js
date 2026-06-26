/**
 * HeatmapEngine — liquidity heatmap matrix (time × price) with a STABLE,
 * auto-ranging price axis so price travels vertically (Bookmap-style) instead
 * of being locked to the centre line.
 *
 * Range model:
 *  • A rolling window of recent mid samples (last ~windowMs) gives [lo, hi].
 *  • The visible band = [lo−pad, hi+pad] × zoomMult, EASED smoothly each tick.
 *  • The range only ever changes inside `tick()` (once per cadence), so within
 *    a frame the heatmap and every overlay read identical pMin/pMax → perfect
 *    alignment.
 *
 * Each column stores its depth pre-binned into `rows` buckets PLUS the price
 * range it was captured at; on render the column is re-mapped into the current
 * range, so the whole history stays aligned as the axis pans — no clearing.
 */
export default class HeatmapEngine {
  constructor({ rows = 200, maxCols = 300, windowMs = 90000, zoomMult = 1 } = {}) {
    this.rows = rows;
    this.maxCols = maxCols;
    this.windowMs = windowMs;
    this.zoomMult = zoomMult;
    this.pMin = 0;
    this.pMax = 0;
    this.columns = [];                 // [{ data:Float32Array(rows), pMin, pMax }]
    this.samples = [];                 // [{ ts, price }]
    this.maxIntensity = 0;
    this.generation = 0;
  }

  hasRange() { return this.pMax > this.pMin; }

  setZoomMult(m) { this.zoomMult = m; }

  /** Record a mid sample and ease the visible band toward recent [lo,hi]. */
  recordSample(price, now) {
    if (!price || price <= 0) return;
    this.samples.push({ ts: now, price });
    const cutoff = now - this.windowMs;
    while (this.samples.length && this.samples[0].ts < cutoff) this.samples.shift();

    let lo = Infinity, hi = -Infinity;
    for (const s of this.samples) { if (s.price < lo) lo = s.price; if (s.price > hi) hi = s.price; }
    if (!isFinite(lo)) { lo = hi = price; }

    const mid = (lo + hi) / 2;
    const rawHalf = (hi - lo) / 2;
    // Pad so the action doesn't touch the edges; floor keeps a sane band when flat.
    const half = Math.max(rawHalf * 1.25 + mid * 0.0008, mid * 0.0015) * this.zoomMult;
    const targetMin = mid - half;
    const targetMax = mid + half;

    if (!this.hasRange()) {
      this.pMin = targetMin; this.pMax = targetMax;
    } else {
      const k = 0.08;                  // easing factor (smooth pan/zoom)
      this.pMin += (targetMin - this.pMin) * k;
      this.pMax += (targetMax - this.pMax) * k;
    }
  }

  priceToRow(price) {
    if (!this.hasRange()) return -1;
    const f = (this.pMax - price) / (this.pMax - this.pMin);
    if (f < 0 || f >= 1) return -1;
    return Math.floor(f * this.rows);
  }

  /** Bin the current book into one column at the CURRENT range and store it. */
  pushColumn(book) {
    if (!this.hasRange()) return;
    const data = new Float32Array(this.rows);
    const { bids, asks } = book.levelsInRange(this.pMin, this.pMax);
    let colMax = 0;
    for (const lv of bids) {
      const r = this.priceToRow(lv.price);
      if (r >= 0) { data[r] += lv.qty; if (data[r] > colMax) colMax = data[r]; }
    }
    for (const lv of asks) {
      const r = this.priceToRow(lv.price);
      if (r >= 0) { data[r] += lv.qty; if (data[r] > colMax) colMax = data[r]; }
    }
    this.maxIntensity = Math.max(colMax, this.maxIntensity * 0.995);
    this.columns.push({ data, pMin: this.pMin, pMax: this.pMax });
    if (this.columns.length > this.maxCols) this.columns.shift();
  }

  /**
   * Build a [maxCols × rows] intensity grid re-mapped to the CURRENT range,
   * newest column flush-right. Returns the Float32Array (row-major per column).
   */
  buildGrid(out) {
    const { rows, maxCols } = this;
    const grid = out && out.length === maxCols * rows ? out : new Float32Array(maxCols * rows);
    grid.fill(0);
    if (!this.hasRange()) return grid;
    const span = this.pMax - this.pMin;
    const n = this.columns.length;
    for (let i = 0; i < n; i++) {
      const col = this.columns[i];
      const gx = maxCols - n + i;            // right-aligned
      if (gx < 0) continue;
      const cSpan = col.pMax - col.pMin;
      const base = gx * rows;
      for (let r = 0; r < rows; r++) {
        const v = col.data[r];
        if (v <= 0) continue;
        const price = col.pMax - (r + 0.5) / rows * cSpan;
        const cr = Math.floor((this.pMax - price) / span * rows);
        if (cr < 0 || cr >= rows) continue;
        if (v > grid[base + cr]) grid[base + cr] = v;   // max keeps bright bands crisp
      }
    }
    return grid;
  }

  clear() {
    this.columns = [];
    this.samples = [];
    this.maxIntensity = 0;
    this.pMin = this.pMax = 0;
    this.generation++;
  }
}
