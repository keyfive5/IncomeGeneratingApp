// Drives the running web build (npx expo start --web --port 8111) through
// the main flows and saves a screenshot of each to .scratch/smoke-*.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8111';
const OUT = '.scratch';
mkdirSync(OUT, { recursive: true });

const tid = (id) => `[data-testid="${id}"]`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function keys(seq) {
  for (const k of seq.split(' ')) {
    await page.click(tid('key-' + k));
    await wait(40);
  }
}
const text = (sel) => page.$eval(sel, (el) => el.innerText);
const shot = (name) => page.screenshot({ path: `${OUT}/smoke-${name}.png` });

try {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('key-7'), { timeout: 60000 });
  await shot('1-empty');

  await keys('5 ft 7 in 3 frac 8 + 2 ft 1 1 in 5 frac 1 6');
  console.log('live:', JSON.stringify(await text(tid('display'))));
  await keys('=');
  await wait(200);
  console.log('after =:', JSON.stringify(await text(tid('display'))));
  await keys('× 2 =');
  await wait(200);
  console.log('× 2:', JSON.stringify(await text(tid('display'))));
  await keys('clear 1 2 ft × 1 4 ft × 4 in =');
  await wait(200);
  console.log('volume:', JSON.stringify(await text(tid('display'))));
  await keys('clear 1 0 ft ÷ 3 =');
  await wait(200);
  console.log('divide:', JSON.stringify(await text(tid('display'))));
  await keys('clear 5 ft +');
  await keys('=');
  await wait(200);
  console.log('error:', JSON.stringify(await text(tid('display'))));
  await shot('2-calc');

  await page.click(tid('tab-tools'));
  await page.waitForSelector(tid('tool-stairs'));
  await shot('3-tools');
  await page.click(tid('tool-stairs'));
  await wait(400);
  await shot('4-stairs-locked');
  await page.click(tid('unlock'));
  await page.waitForSelector(tid('paywall'), { timeout: 5000 });
  await wait(700);
  await shot('5-paywall');
  console.log('paywall:', (await text(tid('paywall'))).slice(0, 200).replace(/\n/g, ' | '));
  await page.keyboard.press('Escape');

  // a free tool is editable
  await page.goto(BASE + '/?tab=tools&tool=concrete', { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('field-len'));
  await page.click(tid('field-len'), { clickCount: 3 });
  await page.type(tid('field-len'), "20'");
  await wait(300);
  console.log('concrete 20ft:', (await page.evaluate(() => document.body.innerText)).match(/Concrete\n[^\n]+\n[^\n]+/)?.[0].replace(/\n/g, ' | '));
  await shot('6-concrete');

  await page.goto(BASE + '/?pro=1&tab=tools&tool=studs', { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('field-wall'));
  await wait(500);
  await shot('7-studs-pro');
  await page.goto(BASE + '/?pro=1&tab=tools&tool=rafter', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('8-rafter');
  await page.goto(BASE + '/?pro=1&tab=tools&tool=miter', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('9-miter');
  await page.goto(BASE + '/?pro=1&tab=tools&tool=arc', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('10-arc');
  await page.goto(BASE + '/?pro=1&tab=tools&tool=spacing', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('11-spacing');
  await page.goto(BASE + '/?pro=1&tab=tools&tool=triangle', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('12-triangle');
  await page.goto(BASE + '/?tab=settings', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('13-settings');
} finally {
  await browser.close();
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no page errors');
