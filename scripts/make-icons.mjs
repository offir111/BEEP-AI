/**
 * Generates BEEP AI PNG icons for all Android mipmap densities
 * using sharp (SVG → PNG rasterizer)
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

// ── BEEP AI Icon SVG ──────────────────────────────────────────
function makeSVG(size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.47;
  const strokeW = size * 0.028;
  const fontSize1 = size * 0.26; // BEEP
  const fontSize2 = size * 0.20; // AI
  const boltScale = size * 0.0014;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#ff9500"/>
      <stop offset="50%"  stop-color="#ffb347"/>
      <stop offset="100%" stop-color="#ff6a00"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${size * 0.02}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tg">
      <feGaussianBlur stdDeviation="${size * 0.012}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <circle cx="${cx}" cy="${cy}" r="${r + strokeW}" fill="url(#bg)"/>

  <!-- Outer glow ring -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ring)"
    stroke-width="${strokeW * 2.5}" filter="url(#glow)" opacity="0.7"/>

  <!-- Sharp ring -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ring)"
    stroke-width="${strokeW}"/>

  <!-- Lightning bolt -->
  <text x="${cx}" y="${cy * 0.62}" text-anchor="middle"
    font-family="Arial Black, sans-serif" font-size="${size * 0.22}"
    fill="#ff9500" filter="url(#glow)">⚡</text>

  <!-- BEEP text -->
  <text x="${cx}" y="${cy * 1.18}" text-anchor="middle"
    font-family="Arial Black, Impact, sans-serif"
    font-size="${fontSize1}" font-weight="900" letter-spacing="${size * 0.012}"
    fill="#ffffff" filter="url(#tg)">BEEP</text>

  <!-- AI text -->
  <text x="${cx}" y="${cy * 1.50}" text-anchor="middle"
    font-family="Arial Black, Impact, sans-serif"
    font-size="${fontSize2}" font-weight="900" letter-spacing="${size * 0.030}"
    fill="#ff9500" filter="url(#glow)">AI</text>

  <!-- Inner ring highlight -->
  <circle cx="${cx}" cy="${cy}" r="${r * 0.93}" fill="none"
    stroke="rgba(255,149,0,0.12)" stroke-width="${strokeW * 0.6}"/>
</svg>`;
}

// ── Density map ──────────────────────────────────────────────
const DENSITIES = [
  { dir: 'mipmap-mdpi',    size: 48,  round: 48  },
  { dir: 'mipmap-hdpi',    size: 72,  round: 72  },
  { dir: 'mipmap-xhdpi',   size: 96,  round: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144, round: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192, round: 192 },
];

// Also generate for public/ (PWA)
const PWA = [
  { path: join(ROOT, 'public', 'icon-192.png'), size: 192 },
  { path: join(ROOT, 'public', 'icon-512.png'), size: 512 },
];

async function generate() {
  // Android mipmap icons
  for (const d of DENSITIES) {
    const dir = join(ROOT, 'android', 'app', 'src', 'main', 'res', d.dir);
    mkdirSync(dir, { recursive: true });

    const svg = Buffer.from(makeSVG(d.size));
    const png = await sharp(svg, { density: 300 }).resize(d.size, d.size).png().toBuffer();

    // Regular + round (same icon for simplicity)
    writeFileSync(join(dir, 'ic_launcher.png'),       png);
    writeFileSync(join(dir, 'ic_launcher_round.png'), png);
    writeFileSync(join(dir, 'ic_launcher_foreground.png'), png);
    console.log(`✅ ${d.dir} (${d.size}px)`);
  }

  // PWA icons
  for (const p of PWA) {
    mkdirSync(dirname(p.path), { recursive: true });
    const svg = Buffer.from(makeSVG(p.size));
    await sharp(svg, { density: 300 }).resize(p.size, p.size).png().toFile(p.path);
    console.log(`✅ PWA ${p.size}px`);
  }

  console.log('\n🎉 All BEEP AI icons generated!');
}

generate().catch(console.error);
