'use strict';
/**
 * Cookie consent banner suppression test.
 * Loads the Cookie Jar extension into a real Chrome instance and visits
 * popular sites, reporting whether any consent UI is still visible.
 *
 * Usage:  node test-consent-banners.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const EXTENSION_PATH = path.resolve(__dirname);

// Sites to test, grouped by the CMP they're known to use.
const SITES = [
  // ── OneTrust (most common retail/media CMP) ───────────────────────────
  { url: 'https://www.cnn.com',         label: 'CNN',           cmp: 'OneTrust' },
  { url: 'https://www.espn.com',        label: 'ESPN',          cmp: 'OneTrust' },
  { url: 'https://www.forbes.com',      label: 'Forbes',        cmp: 'OneTrust' },
  { url: 'https://www.nike.com',        label: 'Nike',          cmp: 'OneTrust' },
  { url: 'https://www.gap.com',         label: 'Gap',           cmp: 'OneTrust' },
  { url: 'https://www.target.com',      label: 'Target',        cmp: 'OneTrust' },
  { url: 'https://www.walmart.com',     label: 'Walmart',       cmp: 'OneTrust' },
  // ── Shopify Customer Privacy ──────────────────────────────────────────
  { url: 'https://www.forever21.com',   label: 'Forever 21',    cmp: 'Shopify' },
  { url: 'https://www.gymshark.com',    label: 'Gymshark',      cmp: 'Shopify' },
  { url: 'https://www.allbirds.com',    label: 'Allbirds',      cmp: 'Shopify' },
  // ── Ketch ─────────────────────────────────────────────────────────────
  { url: 'https://www.patagonia.com',   label: 'Patagonia',     cmp: 'Ketch' },
  // ── CookieYes ─────────────────────────────────────────────────────────
  { url: 'https://mailchimp.com',       label: 'Mailchimp',     cmp: 'CookieYes' },
  // ── CookieBot ─────────────────────────────────────────────────────────
  { url: 'https://www.ikea.com',        label: 'IKEA',          cmp: 'CookieBot' },
  // ── Didomi ────────────────────────────────────────────────────────────
  { url: 'https://www.lemonde.fr',      label: 'Le Monde',      cmp: 'Didomi' },
  // ── SourcePoint ───────────────────────────────────────────────────────
  { url: 'https://www.theguardian.com', label: 'The Guardian',  cmp: 'SourcePoint' },
  // ── Quantcast ─────────────────────────────────────────────────────────
  { url: 'https://www.fandom.com',      label: 'Fandom',        cmp: 'Quantcast' },
  // ── TrustArc ──────────────────────────────────────────────────────────
  { url: 'https://www.linkedin.com',    label: 'LinkedIn',      cmp: 'TrustArc' },
  // ── Custom / misc ─────────────────────────────────────────────────────
  { url: 'https://www.nytimes.com',     label: 'NY Times',      cmp: 'Custom' },
  { url: 'https://www.reddit.com',      label: 'Reddit',        cmp: 'Custom' },
  { url: 'https://www.spotify.com',     label: 'Spotify',       cmp: 'Custom' },
  { url: 'https://www.bbc.com/news',    label: 'BBC News',      cmp: 'Custom' },
  { url: 'https://www.hm.com',          label: 'H&M',           cmp: 'Custom' },
];

// All selectors from content.js (keep in sync)
const CONSENT_SELECTORS = [
  '#cookie-consent-banner','#cookie-consent','#cookieConsent','#cookie-banner',
  '#cookieBanner','#cookie-notice','#cookieNotice','#cookie-bar','#cookiebar',
  '.cookie-consent-banner','.cookie-consent','.cookie-banner','.cookie-notice','.cookie-bar',
  '#onetrust-consent-sdk','#onetrust-banner-sdk','#onetrust-pc-sdk','#onetrust-pc-btn-handler',
  '#ot-sdk-btn-floating','.ot-floating-button','#ot-floating-button__open',
  '#CybotCookiebotDialog','#CybotCookiebotDialogBodyUnderlay',
  '#cookie-law-info-bar','#cky-consent','.cky-consent-container',
  '#cky-btn-revisit','.cky-btn-revisit',
  '#qc-cmp2-container','#qc-cmp2-ui',
  '.sp-message-container',
  '.didomi-popup-container','#didomi-host',
  '#usercentrics-root',
  '#cookiebanner',
  '.cc-window','#cc--main',
  '#truste-consent-track','#truste-show-consent','#truste-frame',
  '#consent_blackbar','.truste_overlay','.truste_box_overlay',
  '#ketch-consent','ketch-consent',
  'shopify-pc-banner','#shopify-pc-banner','#shopify-pc__banner','#shopify-pc-modal','#shopify-pc__modal','shopify-consent-tracking-api',
  '[id*="shopify-pc__"]','[class*="shopify-pc"]',
  '#termly-code-snippet-support',
  '#_evidon_banner','#evidon-barrier-overlay','.evidon-banner',
  '#iubenda-cs-banner','.iubenda-cs-container',
  '.osano-cm-window','.osano-cm-dialog',
  '#cmplz-cookiebanner-container','.cmplz-cookiebanner',
  '#moove_gdpr_cookie_modal','#moove_gdpr_cookie_info_bar',
  '#BorlabsCookie','.borlabs-cookie',
  '#ch2','.ch2-container','#cookiehub',
  '#ccc','.ccc-alert',
  '.cn-notice-container','#cookie-notice-container',
  '[class*="gdpr-lmd"]',
  '[class*="consent-popup"]','[class*="cookie-banner"]',
];

// Broader search for any visible consent-like overlay (catches CMPs we don't know yet)
const HEURISTIC_SELECTORS = [
  '[id*="cookie"]','[class*="cookie"]',
  '[id*="consent"]','[class*="consent"]',
  '[id*="gdpr"]','[class*="gdpr"]',
  '[id*="privacy"]',
  '[id*="ketch"]','[class*="ketch"]',
  '[id*="shopify-pc"]','[class*="shopify-pc"]',
  '[id*="termly"]',
];

const SCREENSHOTSDIR = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(SCREENSHOTSDIR)) fs.mkdirSync(SCREENSHOTSDIR);

function slug(label) { return label.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

async function isVisible(page, selector) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    const box = await el.boundingBox();
    if (!box || box.width === 0 || box.height === 0) return false;
    const display = await el.evaluate(n =>
      getComputedStyle(n).display + '|' + getComputedStyle(n).visibility + '|' + getComputedStyle(n).opacity
    );
    const [disp, vis, op] = display.split('|');
    return disp !== 'none' && vis !== 'hidden' && parseFloat(op) > 0;
  } catch { return false; }
}

async function findVisibleConsentElements(page) {
  const found = [];

  // Check known selectors
  for (const sel of CONSENT_SELECTORS) {
    try {
      if (await isVisible(page, sel)) {
        found.push({ selector: sel, type: 'known' });
      }
    } catch { /* invalid selector for this page */ }
  }

  // Heuristic scan — catch unknown CMPs
  for (const sel of HEURISTIC_SELECTORS) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        const box = await el.boundingBox();
        if (!box || box.width < 50 || box.height < 20) continue;
        const info = await el.evaluate(n => ({
          tag:       n.tagName,
          id:        n.id,
          cls:       n.className,
          disp:      getComputedStyle(n).display,
          vis:       getComputedStyle(n).visibility,
          op:        getComputedStyle(n).opacity,
          zIdx:      getComputedStyle(n).zIndex,
          inlineDisp: n.style.display,
          parentTag: n.parentElement?.tagName || '',
          parentId:  n.parentElement?.id || '',
          inIframe:  window !== window.top,
          text:      n.innerText?.slice(0, 120).replace(/\s+/g, ' ').trim(),
        }));
        if (info.disp === 'none' || info.vis === 'hidden' || parseFloat(info.op) === 0) continue;
        // Only flag if it looks like a consent UI (has relevant text)
        const lowerText = (info.text || '').toLowerCase();
        if (/cookie|consent|privacy|gdpr|tracking|preference|accept|agree|manage/.test(lowerText)) {
          found.push({ selector: sel, type: 'heuristic', info });
          break; // one representative element per selector is enough
        }
      }
    } catch { /* skip */ }
  }

  return found;
}

async function testSite(context, site) {
  const page = await context.newPage();
  const result = { label: site.label, url: site.url, cmp: site.cmp, status: 'pass', issues: [], screenshot: null };

  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Let JS-driven CMPs finish rendering — some CMPs have 8–10s delayed init
    await page.waitForTimeout(10000);

    const visible = await findVisibleConsentElements(page);

    // Diagnostic: verify our injected CSS is present and its computed effect
    result.cssProbe = await page.evaluate(() => {
      const ketchEl = document.querySelector('[id*="ketch"]');
      const shopifyEl = document.querySelector('[id*="shopify-pc"]');
      const oneTrustEl = document.getElementById('onetrust-banner-sdk');
      function probe(el) {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          id: el.id,
          computedDisplay: cs.display,
          computedVisibility: cs.visibility,
          computedOpacity: cs.opacity,
          inlineDisplay: el.style.display,
          inlineDisplayPriority: el.style.getPropertyPriority('display'),
          inlineVisibilityPriority: el.style.getPropertyPriority('visibility'),
          parentId: el.parentElement?.id || '',
          parentTag: el.parentElement?.tagName || '',
        };
      }
      // Check if our style element exists (contains our key selectors)
      const ourStyle = [...document.querySelectorAll('style')].find(s =>
        s.textContent?.includes('ketch') || s.textContent?.includes('shopify-pc') ||
        s.textContent?.includes('onetrust')
      );
      return {
        ketch: probe(ketchEl),
        shopify: probe(shopifyEl),
        oneTrust: probe(oneTrustEl),
        hasOurStyleTag: !!ourStyle,
        styleTagCount: document.querySelectorAll('style').length,
      };
    }).catch(() => null);

    const screenshotPath = path.join(SCREENSHOTSDIR, `${slug(site.label)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;

    if (visible.length > 0) {
      result.status = 'FAIL';
      result.issues = visible;
    }
  } catch (err) {
    result.status = 'ERROR';
    result.issues = [{ error: err.message }];
  } finally {
    await page.close();
  }

  return result;
}

function printResult(r) {
  const icon = r.status === 'pass' ? '✓' : r.status === 'ERROR' ? '⚠' : '✗';
  const pad  = r.label.padEnd(14);
  const p = r.cssProbe;
  const fmt = (el) => el ? `${el.computedDisplay}/${el.computedVisibility}(inline:${el.inlineDisplay||'–'}/${el.inlineDisplayPriority||'–'})` : 'N/A';
  const probeStr = p ? ` | tag:${p.hasOurStyleTag} ketch:${fmt(p.ketch)} shopify:${fmt(p.shopify)} ot:${fmt(p.oneTrust)}` : '';
  console.log(`  ${icon} ${pad} [${r.cmp.padEnd(12)}] ${r.status}${r.status !== 'pass' ? probeStr : ''}`);
  if (r.issues.length) {
    for (const iss of r.issues) {
      if (iss.error) {
        console.log(`      error: ${iss.error}`);
      } else if (iss.type === 'known') {
        console.log(`      known selector still visible: ${iss.selector}`);
      } else {
        const i = iss.info;
        console.log(`      heuristic: <${i.tag.toLowerCase()}> id="${i.id}" class="${String(i.cls).slice(0,60)}"`);
        console.log(`        parent: <${i.parentTag.toLowerCase()}> id="${i.parentId}" | iframe:${i.inIframe} | inline:"${i.inlineDisp||''}"`);
        console.log(`        text: "${i.text?.slice(0, 80)}"`);
      }
    }
  }
}

(async () => {
  console.log('\n Cookie Jar — Consent Banner Suppression Test');
  console.log(' Extension:', EXTENSION_PATH);
  console.log(' Sites:    ', SITES.length);
  console.log('─'.repeat(60));

  // Use a timestamped profile so every run starts with no stored consent cookies
  // or site data that could make banners "pass" by already-accepted consent.
  const profileDir = path.join(require('os').tmpdir(), `cookiejar-test-${Date.now()}`);
  let context;
  try {
    context = await chromium.launchPersistentContext(
      profileDir,
      {
        headless: false,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-first-run',
          '--no-default-browser-check',
        ],
        viewport: { width: 1280, height: 800 },
      }
    );
  } catch (e) {
    console.error('Failed to launch Chrome with extension:', e.message);
    process.exit(1);
  }

  const results = [];
  for (const site of SITES) {
    process.stdout.write(`  Testing ${site.label.padEnd(14)}...`);
    const r = await testSite(context, site);
    results.push(r);
    // Overwrite the "Testing…" line with the result
    process.stdout.write('\r');
    printResult(r);
  }

  await context.close();

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log('─'.repeat(60));
  console.log(`  ${passed} passed  ${failed} failed  ${errors} errors`);
  console.log(`  Screenshots saved to: ${SCREENSHOTSDIR}`);

  if (failed > 0) {
    console.log('\n  FAILED SITES — selectors to add:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`    ${r.label} (${r.cmp}):`);
      for (const iss of r.issues) {
        if (iss.type === 'heuristic' && iss.info) {
          const id  = iss.info.id  ? `#${iss.info.id}`  : '';
          const cls = iss.info.cls ? `.${String(iss.info.cls).trim().split(/\s+/)[0]}` : '';
          console.log(`      → ${id || cls || iss.info.tag.toLowerCase()}`);
        }
      }
    }
    process.exit(1);
  }
})();
