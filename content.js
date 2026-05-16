'use strict';

// ── Cookie consent banner suppression ─────────────────────────────────────
// Hides cookie consent UIs as soon as they appear in the DOM so the user
// never has to interact with them. Covers generic id/class patterns and the
// most common Consent Management Platforms (OneTrust, CookieBot, CookieYes,
// Didomi, Quantcast, SourcePoint, TrustArc, etc.).
(function suppressCookieBanners() {
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
    // OneTrust
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '#onetrust-pc-sdk',
    // CookieBot
    '#CybotCookiebotDialog',
    '#CybotCookiebotDialogBodyUnderlay',
    // CookieYes / cookie-law-info
    '#cookie-law-info-bar',
    '#cky-consent',
    '.cky-consent-container',
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
    // GDPR generic
    '[id*="gdpr"]',
    '[class*="gdpr"]',
  ];

  function hideAll() {
    for (const sel of SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important');
        });
      } catch (_) { /* ignore invalid selectors */ }
    }
  }

  // Act immediately on whatever is already in the DOM
  hideAll();

  // Watch for banners injected after page load (most CMPs use JS to render)
  const observer = new MutationObserver(hideAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

// ── Notify background when new cookies are set via document.cookie ─────────
// Actual cookie reading and removal happens in background.js
(function () {
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
