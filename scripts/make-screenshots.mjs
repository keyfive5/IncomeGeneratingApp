/**
 * Captures App Store screenshots from the web build.
 *
 *   1. npx expo export --platform web          (writes dist/)
 *   2. node scripts/make-screenshots.mjs       (serves dist/ itself)
 *
 * Every shot is the real app: the calculator tape is built by pressing the
 * keys, and each tool shows what it computes for the inputs on screen.
 * ?pro=1 shows the unlocked app (see src/iap/iap.web.ts).
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { SHOT_CAPTIONS } from '../store/metadata.mjs';

const DIST = 'dist';
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;
const OUT = 'store/screenshots';

// 6.9" and 6.5" iPhones. The app is iPhone-only, so no iPad set is needed.
const DEVICES = [
  { name: '6.9', width: 1320, height: 2868, css: [440, 956], scale: 3, radius: 0.075 },
  { name: '6.5', width: 1242, height: 2688, css: [414, 896], scale: 3, radius: 0.075 },
];

const BG = '#0F1113';
const INK = '#F4F2EE';
const TAPE = '#FFCB2E';
const SUB = 'Built for the jobsite. Works offline.';

const tid = (id) => `[data-testid="${id}"]`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function keys(page, seq) {
  for (const k of seq.split(' ')) {
    await page.click(tid('key-' + k));
    await wait(25);
  }
}

/** Scrolls the tool screen so the element with this text sits near the top. */
async function scrollTo(page, text, offset = 12) {
  await page.evaluate(
    (text, offset) => {
      const el = [...document.querySelectorAll('div')].find((d) => d.childElementCount === 0 && d.textContent === text);
      let sc = el?.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && getComputedStyle(sc).overflowY !== 'visible')) sc = sc.parentElement;
      if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - offset;
    },
    text,
    offset,
  );
  await wait(400);
}

const SHOTS = [
  {
    url: '/',
    async run(page) {
      await keys(page, '1 2 ft 7 in 3 frac 8 - 3 in 1 frac 2 =');
      await keys(page, '1 6 ft ÷ 1 6 in =');
      await keys(page, '1 2 ft × 1 0 ft 6 in × 4 in =');
      await keys(page, '9 ft 1 in 1 frac 4 ÷ 1 5 =');
      await keys(page, '5 ft 7 in 3 frac 8 + 2 ft 1 1 in 5 frac 1 6');
    },
  },
  { url: '/?pro=1&tab=tools&tool=stairs', async run(page) { await scrollTo(page, 'Risers', 24); } },
  { url: '/?pro=1&tab=tools&tool=studs', async run(page) { await scrollTo(page, 'Studs', 24); } },
  { url: '/?pro=1&tab=tools&tool=rafter', async run(page) { await scrollTo(page, 'Rafter length (line)', 24); } },
  { url: '/?pro=1&tab=tools&tool=miter', async run(page) { await scrollTo(page, 'Trim', 24); } },
  { url: '/?pro=1&tab=tools&tool=spacing', async run(page) { await scrollTo(page, 'Balusters', 24); } },
];

function captionSvg(width, lines) {
  const size = Math.round(width * 0.075);
  const lead = Math.round(size * 1.16);
  const top = Math.round(width * 0.17);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width * 0.62)}">
    <rect width="100%" height="100%" fill="${BG}"/>
    ${lines
      .map(
        (l, i) =>
          `<text x="50%" y="${top + i * lead}" text-anchor="middle" fill="${i === lines.length - 1 ? TAPE : INK}" font-family="${font}" font-size="${size}" font-weight="800" letter-spacing="-1.5">${esc(l)}</text>`,
      )
      .join('')}
    <text x="50%" y="${top + lines.length * lead + Math.round(size * 0.35)}" text-anchor="middle" fill="#9BA1A8" font-family="${font}" font-size="${Math.round(size * 0.36)}" font-weight="500">${esc(SUB)}</text>
  </svg>`;
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, BASE).pathname);
    let file = path.join(DIST, p === '/' ? 'index.html' : p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('run `npx expo export --platform web` first');
fs.mkdirSync(OUT, { recursive: true });
const server = await serve();
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
});

try {
  for (const device of DEVICES) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await page.setViewport({ width: device.css[0], height: device.css[1], deviceScaleFactor: device.scale, isMobile: true, hasTouch: true });

    for (const [i, shot] of SHOTS.entries()) {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.clear());
      await page.goto(BASE + shot.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector(tid('tab-calc'), { timeout: 30000 });
      await page.evaluate(() => {
        // Chrome paints focus rings and caret iOS would not show here.
        const style = document.createElement('style');
        style.textContent = '*{outline:none !important;caret-color:transparent !important;}';
        document.head.appendChild(style);
      });
      await wait(700);
      await shot.run(page);
      await wait(400);
      const appShot = await page.screenshot({ type: 'png' });

      const capHeight = Math.round(device.height * 0.2);
      const caption = await sharp(Buffer.from(captionSvg(device.width, SHOT_CAPTIONS[i])))
        .resize(device.width, capHeight, { fit: 'cover', position: 'top' })
        .png()
        .toBuffer();
      const margin = Math.round(device.height * 0.02);
      const maxByHeight = Math.floor(((device.height - capHeight - margin) * device.css[0]) / device.css[1]);
      const screenWidth = Math.min(Math.round(device.width * 0.86), maxByHeight);
      const screen = await sharp(appShot).resize({ width: screenWidth }).png().toBuffer();
      const meta = await sharp(screen).metadata();
      const rounded = await sharp(screen)
        .composite([
          {
            input: Buffer.from(`<svg width="${meta.width}" height="${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="${Math.round(meta.width * device.radius)}" fill="#fff"/></svg>`),
            blend: 'dest-in',
          },
        ])
        .png()
        .toBuffer();

      const file = `${OUT}/${device.name}-${i + 1}.png`;
      await sharp({ create: { width: device.width, height: device.height, channels: 4, background: BG } })
        .composite([
          { input: caption, top: 0, left: 0 },
          { input: rounded, top: capHeight, left: Math.round((device.width - screenWidth) / 2) },
        ])
        .flatten({ background: BG })
        .png()
        .toFile(file);
      console.log(`wrote ${file}`);
    }
    await page.close();
  }

  // The purchase sheet, uncaptioned, for the in-app purchase's App Review screenshot.
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport({ width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/?tab=tools&tool=stairs', { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('unlock'), { timeout: 30000 });
  await page.click(tid('unlock'));
  await page.waitForSelector(tid('paywall'), { timeout: 5000 });
  await wait(900);
  await page.screenshot({ path: 'store/iap-review.png', type: 'png' });
  console.log('wrote store/iap-review.png');
  await page.close();
} finally {
  await browser.close();
  server.close();
}
