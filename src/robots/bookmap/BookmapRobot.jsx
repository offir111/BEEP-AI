/**
 * BookmapRobot — "BOOK MAP" — a real, live order-flow terminal in the Bookmap
 * style, fed entirely by Binance real-time data:
 *   @depth@100ms + REST snapshot → local order book → liquidity heatmap & DOM
 *   @aggTrade                     → volume bubbles, market pulse, iceberg/stops
 *   @bookTicker                   → BBO ribbon + live spread
 *
 * Absolutely no synthetic data. When a feed drops or the book goes stale the UI
 * shows 🔴 and stops advancing — it never fabricates or freezes a fake value.
 *
 * Fully isolated under src/robots/bookmap/. External touch points are documented
 * in INTEGRATION.md (route + home card).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

import BinanceDepthFeed from './data/BinanceDepthFeed';
import BinanceTradesFeed from './data/BinanceTradesFeed';
import BinanceBookTicker from './data/BinanceBookTicker';
import OrderBookState from './data/OrderBookState';
import RecordReplayStore from './data/RecordReplayStore';

import HeatmapEngine from './engine/HeatmapEngine';
import VolumeBubblesEngine from './engine/VolumeBubblesEngine';
import BBOEngine from './engine/BBOEngine';
import IcebergStopsEngine from './engine/IcebergStopsEngine';
import MarketPulseEngine from './engine/MarketPulseEngine';
import CandleEngine from './engine/CandleEngine';
import VolumeProfileEngine from './engine/VolumeProfileEngine';
import CVDEngine from './engine/CVDEngine';
import LargeLotEngine from './engine/LargeLotEngine';
import VWAPEngine from './engine/VWAPEngine';
import SpoofEngine from './engine/SpoofEngine';

import HeatmapCanvas from './render/HeatmapCanvas';
import VolumeProfilePanel from './render/VolumeProfilePanel';
import CVDPanel from './render/CVDPanel';
import DOMPanel from './render/DOMPanel';
import PulseFeed from './render/PulseFeed';
import SymbolPicker from './controls/SymbolPicker';
import ZoomControls from './controls/ZoomControls';
import RobotMenu from './controls/RobotMenu';
import IndicatorMenu from './controls/IndicatorMenu';
import ViewModeTabs, { MODE_PRESETS } from './controls/ViewModeTabs';
import ReplayControls from './controls/ReplayControls';

import './styles/bookmap.css';

const DEFAULT_SYMBOL = 'BTCUSDT';

function worstStatus(...s) {
  if (s.includes('disconnected')) return 'disconnected';
  if (s.includes('connecting')) return 'connecting';
  if (s.every(x => x === 'live')) return 'live';
  return 'connecting';
}
function fmtPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

export default function BookmapRobot({ navigate }) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const isCrypto = /USDT$/.test(symbol);   // our picker only yields live USDT pairs

  const [mode, setMode] = useState('heatmap');    // primary visualization mode (default heatmap, not book)
  const [toggles, setToggles] = useState({ ...MODE_PRESETS.heatmap });
  const [zoomMult, setZoomMult] = useState(1);   // vertical zoom multiplier on the auto-range

  // Apply a view-mode preset (still lets the אינדיקטורים menu fine-tune layers after).
  const applyMode = useCallback((m) => {
    setMode(m);
    if (MODE_PRESETS[m]) setToggles({ ...MODE_PRESETS[m] });
  }, []);
  const [status, setStatus] = useState({ depth: 'connecting', trade: 'connecting', bbo: 'connecting' });
  const [recording, setRecording] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [demoMsg, setDemoMsg] = useState(null);

  // Replay state
  const [replay, setReplay] = useState({ active: false, playing: false, progress: 0, speed: 1, total: 0 });

  // ── Engines (stable for the lifetime of the component) ──
  const enginesRef = useRef(null);
  if (!enginesRef.current) {
    enginesRef.current = {
      heatmap: new HeatmapEngine(),
      bubbles: new VolumeBubblesEngine(),
      bbo: new BBOEngine(),
      iceberg: new IcebergStopsEngine(),
      pulse: new MarketPulseEngine(),
      candle: new CandleEngine(),
      profile: new VolumeProfileEngine(),
      cvd: new CVDEngine(),
      largeLot: new LargeLotEngine(),
      vwap: new VWAPEngine(),
      spoof: new SpoofEngine(),
    };
  }
  const engines = enginesRef.current;

  // Feeds + current book pointer (live or replay)
  const feedsRef = useRef({ depth: null, trades: null, book: null });
  const liveBookRef = useRef(null);
  const replayBookRef = useRef(null);
  const inReplayRef = useRef(false);
  const recordStore = useRef(null);
  const recordingRef = useRef(false);
  const nowRef = useRef(Date.now());   // virtual clock during replay

  const getBook = useCallback(() => inReplayRef.current ? replayBookRef.current : liveBookRef.current, []);
  const getNow = useCallback(() => inReplayRef.current ? nowRef.current : Date.now(), []);

  // ── Live header readout (throttled) ──
  const [readout, setReadout] = useState({ price: null, spread: null });
  useEffect(() => {
    const iv = setInterval(() => {
      const book = getBook();
      const last = engines.bbo.last;
      const price = book && book.ready ? book.mid() : (last ? (last.bidPrice + last.askPrice) / 2 : null);
      const spread = engines.bbo.spread();
      setReadout({ price, spread });
    }, 250);
    return () => clearInterval(iv);
  }, [engines, getBook]);

  // ── Prune transient overlays on a real/virtual clock ──
  useEffect(() => {
    const iv = setInterval(() => {
      const now = getNow();
      engines.bubbles.prune(now);
      engines.iceberg.prune(now);
      engines.largeLot.prune(now);
      engines.spoof.prune(now);
    }, 500);
    return () => clearInterval(iv);
  }, [engines, getNow]);

  // ── Wire a trade through every consumer ──
  const handleTrade = useCallback((t) => {
    engines.bubbles.addTrade(t);
    engines.bbo.addTrade(t);
    engines.candle.addTrade(t);
    engines.profile.addTrade(t);
    engines.cvd.addTrade(t);
    engines.largeLot.addTrade(t);
    engines.vwap.addTrade(t);
    const before = engines.iceberg.events.length;
    engines.iceberg.onTrade(t);
    const sweep = engines.iceberg.events.length > before &&
      engines.iceberg.events[engines.iceberg.events.length - 1].type === 'stop';
    engines.pulse.addTrade(t, sweep);
    if (recordingRef.current && recordStore.current) recordStore.current.push('trade', t.ts, t);
  }, [engines]);

  // ── Start / restart live feeds for a symbol ──
  const startLive = useCallback((sym) => {
    // tear down anything running
    feedsRef.current.depth?.stop();
    feedsRef.current.trades?.stop();
    feedsRef.current.book?.stop();
    Object.values(engines).forEach(e => e.clear && e.clear());

    if (!/USDT$/.test(sym)) {
      // Non-crypto: no free order-book depth → explicit DEMO, no fake feeds.
      liveBookRef.current = null;
      setStatus({ depth: 'disconnected', trade: 'disconnected', bbo: 'disconnected' });
      return;
    }

    const depth = new BinanceDepthFeed(sym, {
      onStatus: (s) => setStatus(p => ({ ...p, depth: s })),
      onUpdate: (book) => {
        liveBookRef.current = book;
        engines.iceberg.onBook(book);
        engines.spoof.onBook(book);
      },
      onRawDiff: (ev) => {
        if (recordingRef.current && recordStore.current)
          recordStore.current.push('depth', ev.E || Date.now(), ev);
      },
    });
    const trades = new BinanceTradesFeed(sym, {
      onStatus: (s) => setStatus(p => ({ ...p, trade: s })),
      onTrade: handleTrade,
    });
    const ticker = new BinanceBookTicker(sym, {
      onStatus: (s) => setStatus(p => ({ ...p, bbo: s })),
      onBBO: (b) => {
        engines.bbo.addBBO(b);
        if (recordingRef.current && recordStore.current) recordStore.current.push('bbo', b.ts, b);
      },
    });

    liveBookRef.current = depth.book;
    feedsRef.current = { depth, trades, book: ticker };
    depth.start(); trades.start(); ticker.start();
  }, [engines, handleTrade]);

  // (re)start feeds on symbol change; full cleanup on unmount
  useEffect(() => {
    if (inReplayRef.current) return;   // don't disturb an active replay
    engines.heatmap.setZoomMult(zoomMult);
    startLive(symbol);
    return () => {
      feedsRef.current.depth?.stop();
      feedsRef.current.trades?.stop();
      feedsRef.current.book?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Apply zoom multiplier to the heatmap auto-range
  useEffect(() => { engines.heatmap.setZoomMult(zoomMult); }, [engines, zoomMult]);

  // Full unmount cleanup (sockets + recorder)
  useEffect(() => () => {
    feedsRef.current.depth?.stop();
    feedsRef.current.trades?.stop();
    feedsRef.current.book?.stop();
    recordStore.current?.stop();
  }, []);

  // ── Recording ──
  const toggleRecord = useCallback(async () => {
    if (recording) {
      recordingRef.current = false;
      recordStore.current?.stop();
      const n = await recordStore.current?.count();
      setRecCount(n || 0);
      setRecording(false);
      return;
    }
    if (!recordStore.current) recordStore.current = new RecordReplayStore();
    const ok = await recordStore.current.start();
    if (!ok) { setDemoMsg('IndexedDB לא זמין — הקלטה לא אפשרית'); setTimeout(() => setDemoMsg(null), 3000); return; }
    // Seed with the current real book snapshot so replay can reconstruct it.
    const book = liveBookRef.current;
    if (book && book.ready) {
      recordStore.current.push('snapshot', Date.now(), {
        lastUpdateId: book.lastUpdateId,
        bids: [...book.bids.entries()].map(([p, q]) => [p, String(q)]),
        asks: [...book.asks.entries()].map(([p, q]) => [p, String(q)]),
      });
    }
    recordingRef.current = true;
    setRecording(true);
  }, [recording]);

  // Live tick counter while recording
  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(async () => {
      const n = await recordStore.current?.count();
      setRecCount(n || 0);
    }, 1000);
    return () => clearInterval(iv);
  }, [recording]);

  // ── Replay ──
  const replayTicksRef = useRef([]);
  const replayWallRef = useRef(0);

  const rebuildTo = useCallback((playhead) => {
    const ticks = replayTicksRef.current;
    const book = new OrderBookState();
    Object.values(engines).forEach(e => e.clear && e.clear());
    engines.heatmap.setZoomMult(zoomMult);
    for (const tk of ticks) {
      if (tk.ts > playhead) break;
      if (tk.kind === 'snapshot') book.applySnapshot(tk.data);
      else if (tk.kind === 'depth') book.applyDiff(tk.data);
      else if (tk.kind === 'trade') {
        engines.bubbles.addTrade(tk.data);
        engines.bbo.addTrade(tk.data);
        engines.iceberg.onTrade(tk.data);
        engines.pulse.addTrade(tk.data, false);
        engines.candle.addTrade(tk.data);
        engines.profile.addTrade(tk.data);
        engines.cvd.addTrade(tk.data);
        engines.largeLot.addTrade(tk.data);
        engines.vwap.addTrade(tk.data);
      } else if (tk.kind === 'bbo') engines.bbo.addBBO(tk.data);
    }
    replayBookRef.current = book;
    nowRef.current = playhead;
  }, [engines, zoomMult]);

  const enterReplay = useCallback(async () => {
    if (!recordStore.current) return;
    const ticks = await recordStore.current.loadAll();
    if (!ticks.length) { setDemoMsg('אין הקלטה לשחזור'); setTimeout(() => setDemoMsg(null), 2500); return; }
    // pause live
    feedsRef.current.depth?.stop();
    feedsRef.current.trades?.stop();
    feedsRef.current.book?.stop();
    replayTicksRef.current = ticks;
    inReplayRef.current = true;
    const t0 = ticks[0].ts, t1 = ticks[ticks.length - 1].ts;
    replayWallRef.current = Date.now();
    rebuildTo(t0);
    setReplay({ active: true, playing: true, progress: 0, speed: 1, total: ticks.length });
  }, [rebuildTo]);

  const exitReplay = useCallback(() => {
    inReplayRef.current = false;
    replayBookRef.current = null;
    setReplay({ active: false, playing: false, progress: 0, speed: 1, total: 0 });
    Object.values(engines).forEach(e => e.clear && e.clear());
    startLive(symbol);
  }, [engines, startLive, symbol]);

  // Replay clock
  useEffect(() => {
    if (!replay.active || !replay.playing) return;
    replayWallRef.current = Date.now();
    const iv = setInterval(() => {
      const ticks = replayTicksRef.current;
      if (!ticks.length) return;
      const t0 = ticks[0].ts, t1 = ticks[ticks.length - 1].ts;
      const span = Math.max(1, t1 - t0);
      const wallNow = Date.now();
      const dWall = wallNow - replayWallRef.current;
      replayWallRef.current = wallNow;
      let ph = nowRef.current + dWall * replay.speed;
      if (ph >= t1) { ph = t1; }
      // incremental apply since last playhead
      const prev = nowRef.current;
      for (const tk of ticks) {
        if (tk.ts <= prev || tk.ts > ph) continue;
        if (tk.kind === 'snapshot') replayBookRef.current?.applySnapshot(tk.data);
        else if (tk.kind === 'depth') replayBookRef.current?.applyDiff(tk.data);
        else if (tk.kind === 'trade') {
          engines.bubbles.addTrade(tk.data); engines.bbo.addTrade(tk.data);
          engines.iceberg.onTrade(tk.data); engines.pulse.addTrade(tk.data, false);
          engines.candle.addTrade(tk.data); engines.profile.addTrade(tk.data);
          engines.cvd.addTrade(tk.data); engines.largeLot.addTrade(tk.data);
          engines.vwap.addTrade(tk.data);
        } else if (tk.kind === 'bbo') engines.bbo.addBBO(tk.data);
      }
      if (replayBookRef.current) {
        engines.iceberg.onBook(replayBookRef.current);
        engines.spoof.onBook(replayBookRef.current, nowRef.current);
      }
      nowRef.current = ph;
      const progress = (ph - t0) / span;
      setReplay(r => ({ ...r, progress }));
      if (ph >= t1) setReplay(r => ({ ...r, playing: false }));
    }, 60);
    return () => clearInterval(iv);
  }, [replay.active, replay.playing, replay.speed, engines]);

  const onScrub = useCallback((p) => {
    const ticks = replayTicksRef.current;
    if (!ticks.length) return;
    const t0 = ticks[0].ts, t1 = ticks[ticks.length - 1].ts;
    rebuildTo(t0 + p * (t1 - t0));
    setReplay(r => ({ ...r, progress: p }));
  }, [rebuildTo]);

  // ── Derived UI ──
  const overall = isCrypto ? worstStatus(status.depth, status.trade, status.bbo) : 'demo';
  const book = getBook();
  const stale = book ? book.isStale() : true;
  const statusInfo = replay.active
    ? { dot: '⏯️', text: `שחזור ${Math.round(replay.progress * 100)}%`, cls: 'replay' }
    : !isCrypto
      ? { dot: '🟡', text: 'DEMO', cls: 'demo' }
      : overall === 'live' && !stale
        ? { dot: '🟢', text: 'LIVE', cls: 'live' }
        : overall === 'connecting'
          ? { dot: '🟠', text: 'מתחבר…', cls: 'connecting' }
          : { dot: '🔴', text: 'מנותק', cls: 'down' };

  return (
    <div className="bm-root" dir="rtl">
      {/* ── Single top bar (replaces the old X-row + robots row + header + controls row) ── */}
      <div className="bm-topbar">
        <button className="bm-close" onClick={() => navigate('home')} aria-label="סגור">✕</button>
        <RobotMenu navigate={navigate} />
        <IndicatorMenu toggles={toggles} onToggle={(k) => setToggles(t => ({ ...t, [k]: !t[k] }))} />
        <ZoomControls zoomMult={zoomMult} onChange={setZoomMult} />
        <SymbolPicker symbol={symbol} onChange={(s) => { if (!inReplayRef.current) setSymbol(s); }} />
        <div className={`bm-status bm-status--${statusInfo.cls}`}>{statusInfo.dot} {statusInfo.text}</div>
        <div className="bm-price-big">{fmtPrice(readout.price)}</div>
        <div className="bm-spread">Spr {readout.spread != null && readout.spread >= 0 ? fmtPrice(readout.spread) : '—'}</div>
        <div className="bm-topbar-spacer" />
        <button className={`bm-rec ${recording ? 'bm-rec--on' : ''}`} onClick={toggleRecord} disabled={!isCrypto}>
          {recording ? `⏺️ ${recCount}` : '⏺️ הקלטה'}
        </button>
        {recCount > 0 && !recording && !replay.active && (
          <button className="bm-rec" onClick={enterReplay}>⏵ שחזור ({recCount})</button>
        )}
      </div>

      {/* ── Primary view-mode selector — always visible, phone-friendly ── */}
      <ViewModeTabs mode={mode} onMode={applyMode} />

      {!isCrypto && (
        <div className="bm-demo-banner">
          🟡 DEMO — לסימבול זה אין עומק ספר חינמי. הצג מטבע USDT (כגון BTCUSDT) לנתוני אמת.
        </div>
      )}

      {/* ── Chart + side panels ── */}
      <div className="bm-main">
        <div className="bm-chart">
          <div className="bm-chart-stack">
            <HeatmapCanvas
              engines={engines}
              getBook={getBook}
              getNow={getNow}
              running={isCrypto}
              toggles={toggles}
            />
            <CVDPanel engines={engines} getNow={getNow} />
          </div>
          {toggles.profile && <VolumeProfilePanel engines={engines} getBook={getBook} />}
        </div>
        <div className="bm-side">
          <DOMPanel getBook={getBook} />
          <PulseFeed engine={engines.pulse} />
        </div>
      </div>

      <ReplayControls
        active={replay.active}
        playing={replay.playing}
        progress={replay.progress}
        speed={replay.speed}
        total={replay.total}
        onPlayPause={() => setReplay(r => ({ ...r, playing: !r.playing }))}
        onScrub={onScrub}
        onSpeed={(s) => setReplay(r => ({ ...r, speed: s }))}
        onExit={exitReplay}
      />

      {demoMsg && <div className="bm-toast">{demoMsg}</div>}
    </div>
  );
}
