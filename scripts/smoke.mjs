// Smoke-test the extension: launch Chromium with it loaded, confirm the service
// worker registers (manifest + background bundle load OK), and check that the
// auto-reject engine clears consent banners on a few real sites with no
// extension-side errors.
//
//   npm run smoke              # test the working tree (this repo)
//   npm run smoke -- dist/pkg  # test an unpacked/extracted package directory
//
// Exit code is non-zero if the service worker fails to register or logs errors.
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.resolve(process.argv[2] || repoRoot);

const SITES = [
  'https://www.theguardian.com', // Sourcepoint
  'https://www.espn.com',        // OneTrust
  'https://www.bbc.com/news',    // custom
  'https://www.ikea.com',        // Cookiebot
];
const SELECTORS = [
  '#onetrust-banner-sdk', '#CybotCookiebotDialog', '.sp-message-container',
  '[class*="cookie-banner"]', '[id*="consent-banner"]', '#truste-consent-track',
  '.cky-consent-container', '#cookie-law-info-bar',
];

console.log('Smoke-testing extension at:', EXT);
if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('No manifest.json found at that path.');
  process.exit(1);
}

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cj-smoke-'));
let ctx;
try {
  ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 800 },
  });
} catch (e) {
  console.error('LAUNCH FAILED:', e.message);
  process.exit(1);
}

// Service worker registered => manifest is valid and background.js + its
// importScripts (incl. vendor/autoconsent/background-helpers.bundle.js) loaded.
let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 20000 }).catch(() => null);
const swErrors = [];
if (sw) sw.on('console', (m) => { if (m.type() === 'error') swErrors.push(m.text()); });
console.log(sw ? `EXTENSION LOADED ✓  (service worker: ${sw.url().slice(0, 64)}…)` : 'EXTENSION SERVICE WORKER NOT DETECTED ✗');

let clean = 0;
for (const url of SITES) {
  const page = await ctx.newPage();
  const ac = [];
  const errs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/autoconsent|cmp|consent/i.test(t)) ac.push(t);
    if (m.type() === 'error') errs.push(t);
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.log(`  ✗ ${url} — navigation failed: ${e.message.split('\n')[0]}`);
    await page.close();
    continue;
  }
  await page.waitForTimeout(6000); // let the engine detect + reject
  let visible = false;
  for (const sel of SELECTORS) {
    try { if (await page.locator(sel).first().isVisible()) { visible = true; break; } } catch {}
  }
  if (!visible) clean++;
  console.log(`  ${!visible ? '✓' : '✗'} ${url} — banner ${visible ? 'STILL VISIBLE' : 'gone'} | engine msgs: ${ac.length} | page errors: ${errs.length}`);
  await page.close();
}

console.log(`\nSMOKE RESULT: extension loaded=${!!sw} | ${clean}/${SITES.length} sites banner-clean | service-worker errors=${swErrors.length}`);
if (swErrors.length) console.log('SW ERRORS:', swErrors.slice(0, 5));
await ctx.close();
process.exit(swErrors.length || !sw ? 1 : 0);
