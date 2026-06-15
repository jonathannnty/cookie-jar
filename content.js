'use strict';

// Ask the background whether auto-consent is enabled for this frame's domain.
// When enabled, the vendored autoconsent engine owns banner handling and the
// legacy CSS/JS hide must stand down (its display:none would block reject clicks).
// When disabled (or the background is unavailable), install the legacy hide.
function shouldRunLegacyHide() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'IS_AUTOCONSENT_ON', url: location.href }, (resp) => {
        if (chrome.runtime.lastError) return resolve(true);
        resolve(!(resp && resp.on));
      });
    } catch (_) { resolve(true); }
  });
}

// ── Cookie consent banner suppression ─────────────────────────────────────
// Hides cookie consent UIs as soon as they appear in the DOM so the user
// never has to interact with them. Covers generic id/class patterns and the
// most common Consent Management Platforms (OneTrust, CookieBot, CookieYes,
// Didomi, Quantcast, SourcePoint, TrustArc, Shopify, Ketch, etc.).
// Runs at document_start so CSS is injected before the page renders, preventing
// any flash of consent banners.
function suppressCookieBanners() {
  const SELECTORS = [
    // Generic id/class patterns
    '#cookie-consent-banner',
    '#cookie-consent',
    '#cookieConsent',
    '#cookie-banner',
    '#cookieBanner',
    '#cookie-notice',
    '#cookieNotice',
    '#cookie-bar',
    '#cookiebar',
    '.cookie-consent-banner',
    '.cookie-consent',
    '.cookie-banner',
    '.cookie-notice',
    '.cookie-bar',
    '[id*="cookie-consent"]',
    '[id*="cookie_consent"]',
    '[class*="cookie-consent"]',
    '[class*="cookie_consent"]',
    // OneTrust — banner, settings modal, persistent floating button, and legacy handler button
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '#onetrust-pc-sdk',
    '#onetrust-pc-btn-handler',
    '#ot-sdk-btn-floating',
    '.ot-floating-button',
    '#ot-floating-button__open',
    // CookieBot
    '#CybotCookiebotDialog',
    '#CybotCookiebotDialogBodyUnderlay',
    // CookieYes / cookie-law-info — banner and persistent revisit button
    '#cookie-law-info-bar',
    '#cky-consent',
    '.cky-consent-container',
    '#cky-btn-revisit',
    '.cky-btn-revisit',
    // Quantcast Choice
    '#qc-cmp2-container',
    '#qc-cmp2-ui',
    // SourcePoint
    '.sp-message-container',
    // Didomi
    '.didomi-popup-container',
    '#didomi-host',
    // Usercentrics
    '#usercentrics-root',
    // Cookiebot (standalone)
    '#cookiebanner',
    // cc-cookie-accept (older implementations)
    '.cc-window',
    '#cc--main',
    // TrustArc / TRUSTe
    '#truste-consent-track',
    '#truste-show-consent',
    '#truste-frame',
    '#consent_blackbar',
    '.truste_overlay',
    '.truste_box_overlay',
    // Ketch
    'ketch-consent',
    '#ketch-consent',
    '#ketch-banner',
    '#ketch-consent-banner',
    '[id*="ketch"]',
    '[class*="ketch-module"]',
    '[class*="ketch-consent"]',
    // Shopify Customer Privacy (shopify-pc) — custom web component + BEM light-DOM children
    'shopify-pc-banner',
    '#shopify-pc-banner',
    '#shopify-pc__banner',
    '#shopify-pc-modal',
    '#shopify-pc__modal',
    'shopify-consent-tracking-api',
    '[id*="shopify-pc"]',
    '[id*="shopify-pc__"]',
    '[class*="shopify-pc"]',
    // Termly
    '#termly-code-snippet-support',
    '[id*="termly"]',
    // Evidon / Ghostery
    '#_evidon_banner',
    '#evidon-barrier-overlay',
    '.evidon-banner',
    // Cookie Script
    '#cookie-script-tagmanager',
    '[id*="cookie-script"]',
    // Iubenda
    '#iubenda-cs-banner',
    '.iubenda-cs-container',
    '[id*="iubenda"]',
    // Osano
    '.osano-cm-window',
    '.osano-cm-dialog',
    '#osano-cm-window',
    // Complianz (WordPress)
    '#cmplz-cookiebanner-container',
    '.cmplz-cookiebanner',
    // Moove GDPR Cookie Compliance (WordPress)
    '#moove_gdpr_cookie_modal',
    '#moove_gdpr_cookie_info_bar',
    // Borlabs Cookie (WordPress)
    '#BorlabsCookie',
    '.borlabs-cookie',
    // CookieHub
    '#ch2',
    '.ch2-container',
    '#cookiehub',
    // Civic Cookie Control
    '#ccc',
    '.ccc-alert',
    // Cookie Notice (WP)
    '.cn-notice-container',
    '#cookie-notice-container',
    // Le Monde / custom Didomi wrappers
    '[class*="gdpr-lmd"]',
    // Privacy / consent generic catch-alls
    '[id*="privacy-banner"]',
    '[id*="privacy-overlay"]',
    '[id*="consent-banner"]',
    '[id*="consent-modal"]',
    '[id*="consent-dialog"]',
    '[class*="consent-modal"]',
    '[class*="consent-dialog"]',
    '[class*="consent-overlay"]',
    '[class*="consent-popup"]',
    '[class*="cookie-modal"]',
    '[class*="cookie-overlay"]',
    '[class*="cookie-popup"]',
    '[class*="cookie-banner"]',
    '[class*="cookie-wall"]',
    // GDPR generic
    '[id*="gdpr"]',
    '[class*="gdpr"]',
    // Twitch / generic consent-banner class pattern
    '[class*="consent-banner"]',
    // Cookie settings / preference panels (H&M and others)
    '[id*="cookie-settings"]',
    '[class*="cookie-settings"]',
    '[id*="cookie-preference"]',
    '[class*="cookie-preference"]',
    '[id*="cookie-pref"]',
    '[class*="cookie-pref"]',
    '[id*="privacy-preference"]',
    '[class*="privacy-preference"]',
    '[class*="privacy-banner"]',
    '[class*="privacy-overlay"]',
    // Manage-cookies floating buttons
    '[class*="manage-cookies"]',
    '[id*="manage-cookies"]',
    '[class*="manage-consent"]',
    '[id*="manage-consent"]',
    // Amazon
    '#sp-cc',
    '#sp-cc-reallow-btn',
    '.sp-cc',
    '[id*="sp-cc"]',
    // YouTube consent bump
    'ytd-consent-bump-v2-renderer',
    '#consent-bump',
    '[id*="consent-bump"]',
    '[class*="consent-bump"]',
  ];

  const HIDE_PROPS = 'display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;';

  // Standard-specificity rules (catches most cases).
  const CSS_RULES = SELECTORS.join(',\n') + '{' + HIDE_PROPS + '}';

  // High-specificity rules: `:root #id` = (1,1,0) beats CMP's `#id` = (1,0,0) for
  // same-origin !important battles where source order would otherwise let the CMP win.
  const HIGH_SPEC_CSS = SELECTORS.map(s => ':root ' + s).join(',\n') + '{' + HIDE_PROPS + '}';

  const FULL_CSS = CSS_RULES + '\n' + HIGH_SPEC_CSS;

  // Early injection at document_start — catches banners that render synchronously
  // during HTML parse before any external CMP stylesheet has loaded.
  const earlyStyle = document.createElement('style');
  earlyStyle.textContent = FULL_CSS;
  (document.head || document.documentElement).appendChild(earlyStyle);

  // Late injection after DOMContentLoaded — appended after all page stylesheets so
  // it wins same-origin same-specificity !important source-order ties.
  document.addEventListener('DOMContentLoaded', () => {
    const lateStyle = document.createElement('style');
    lateStyle.textContent = FULL_CSS;
    (document.head || document.documentElement).appendChild(lateStyle);
  }, { once: true });

  // Track elements we've explicitly hidden so we can counter CMP re-show attempts.
  const targeted = new WeakSet();

  function hideEl(el) {
    targeted.add(el);
    // Early return if already fully hidden — breaks infinite mutation loops when our
    // own setProperty fires an attribute mutation that calls hideEl again.
    if (el.style.getPropertyValue('display') === 'none' &&
        el.style.getPropertyPriority('display') === 'important' &&
        el.style.getPropertyValue('visibility') === 'hidden' &&
        el.style.getPropertyPriority('visibility') === 'important') return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  function hideAll() {
    for (const sel of SELECTORS) {
      try { document.querySelectorAll(sel).forEach(hideEl); }
      catch (_) { /* ignore invalid selectors */ }
    }
  }

  // Act immediately on whatever is already in the DOM
  hideAll();

  // Periodic sweeps for 60 seconds — catches CMPs that re-show their banner via
  // setTimeout/rAF after our initial hide (Ketch, Shopify, etc.) or lazy-load
  // consent scripts well after DOMContentLoaded.
  let sweepsDone = 0;
  function scheduleSweep() {
    hideAll();
    if (++sweepsDone < 120) setTimeout(scheduleSweep, 500);
  }
  setTimeout(scheduleSweep, 500);

  // Watch for:
  //   childList — banners injected after page load (most CMPs render via JS)
  //   attributes — CMPs that re-show their banner by modifying style/class/hidden
  const observer = new MutationObserver(mutations => {
    let hasNewNodes = false;
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        hasNewNodes = true;
      } else if (m.type === 'attributes' && targeted.has(m.target)) {
        // A CMP modified the style/class of a banner we already hid — re-hide it.
        hideEl(m.target);
      }
    }
    if (hasNewNodes) hideAll();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
  });
}

shouldRunLegacyHide().then((run) => { if (run) suppressCookieBanners(); });

// ── Notify background when new cookies are set via document.cookie ─────────
// Actual cookie reading and removal happens in background.js
(function () {
  if (window.self !== window.top) return; // Only override in the top-level frame
  const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (!originalDescriptor) return;

  let notifyTimeout = null;

  function scheduleNotify() {
    clearTimeout(notifyTimeout);
    notifyTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'APPLY_PREFS', url: location.href }).catch(() => {});
    }, 500);
  }

  Object.defineProperty(document, 'cookie', {
    get: originalDescriptor.get,
    set(val) {
      originalDescriptor.set.call(this, val);
      scheduleNotify();
    },
    configurable: true,
  });
})();
