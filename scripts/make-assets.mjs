// Generates the app icon, splash and favicons from vector sources.
//
// The mark: a length of tape-measure blade, tilted, with its tick marks and a
// saw kerf cut clean through it under a carpenter's V mark.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const INK = '#0F1113';
const TAPE = '#FFCB2E';
const TAPE_INK = '#17140A';
const ORANGE = '#FF7A1A';

function blade() {
  // drawn level on a 1024 grid, then rotated as a group
  const y = 402;
  const h = 250;
  let ticks = '';
  for (let x = -200, i = 0; x <= 1240; x += 32, i++) {
    const len = i % 4 === 0 ? 120 : i % 2 === 0 ? 78 : 48;
    ticks += `<rect x="${x - 5}" y="${y}" width="10" height="${len}" fill="${TAPE_INK}"/>`;
  }
  const kerfX = 596;
  return `
    <g transform="rotate(-14 512 512)">
      <rect x="-220" y="${y}" width="1480" height="${h}" fill="${TAPE}"/>
      ${ticks}
      <rect x="-220" y="${y + h - 16}" width="1480" height="16" fill="#E0A800"/>
      <rect x="${kerfX}" y="${y - 40}" width="40" height="${h + 80}" fill="${INK}"/>
    </g>`;
}

function icon({ bg = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#24282D"/>
      <stop offset="1" stop-color="${INK}"/>
    </linearGradient>
    <clipPath id="c"><rect width="1024" height="1024"/></clipPath>
  </defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}
  <g clip-path="url(#c)">${blade()}</g>
  <path d="M497 196 L577 290 L657 196" fill="none" stroke="${ORANGE}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/** Splash: the icon as a rounded tile, centred on the app background. */
function splash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><clipPath id="r"><rect x="312" y="312" width="400" height="400" rx="90"/></clipPath></defs>
  <g clip-path="url(#r)"><g transform="translate(312,312) scale(0.390625)">${icon().replace(/<\/?svg[^>]*>/g, '')}</g></g>
</svg>`;
}

async function write(name, svg, size) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg)).resize(size, size).flatten(name === 'icon.png' ? { background: INK } : false).png({ compressionLevel: 9 }).toFile(file);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  ${name.padEnd(32)} ${size}x${size}  ${kb} KB`);
}

console.log('assets:');
await write('icon.png', icon(), 1024);
await write('favicon.png', icon(), 96);
await write('splash.png', splash(), 1024);
await write('android-icon-foreground.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g transform="translate(190,190) scale(0.629)">${icon({ bg: false }).replace(/<\/?svg[^>]*>/g, '')}</g></svg>`, 1024);
for (const old of ['android-icon-background.png', 'android-icon-monochrome.png', 'adaptive-icon.png', 'splash-icon.png']) {
  fs.rmSync(path.join(OUT, old), { force: true });
}
console.log('done');
