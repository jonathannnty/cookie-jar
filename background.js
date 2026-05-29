'use strict';

importScripts('./utils/cookie-classifier.js');
importScripts('./utils/prefs.js');

// ── OAuth / Identity-Provider passlist ───────────────────────────────────────
// These domains exist solely for authentication. Any interference (cookie
// deletion or consent CSS) breaks OAuth flows with ERR_TOO_MANY_REDIRECTS.
const OAUTH_PASSLIST = new Set([
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'account.live.com',
  'login.windows.net',
  'account.microsoft.com',
  'accounts.microsoft.com',
  'appleid.apple.com',
  'auth.apple.com',
  'idmsa.apple.com',
  'gsa.apple.com',
  'auth.atlassian.com',
  'id.atlassian.com',
  'login.atlassian.net',
  'login.salesforce.com',
  'identity.salesforce.com',
  'auth.services.mozilla.com',
  'accounts.firefox.com',
]);

// Any subdomain of these is also exempt.
const OAUTH_PASSLIST_SUFFIXES = [
  '.okta.com', '.oktapreview.com',
  '.auth0.com',
  '.onelogin.com',
  '.pingidentity.com',
  '.duosecurity.com', '.duo.com',
  '.forgerock.io', '.forgerock.com',
];

function isOAuthDomain(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (OAUTH_PASSLIST.has(h)) return true;
  return OAUTH_PASSLIST_SUFFIXES.some(s => h === s.slice(1) || h.endsWith(s));
}

// Used only in cookies.onChanged where we have the cookie domain, not the tab URL.
// OAuth providers set cookies on their PARENT domain (e.g. .google.com, .live.com),
// not the specific auth subdomain (accounts.google.com). isOAuthDomain() misses these
// because 'google.com' isn't in the passlist — only 'accounts.google.com' is.
// This function also protects any parent domain whose subdomain is in the passlist.
function isOAuthCookieDomain(domain) {
  if (!domain) return false;
  const h = domain.toLowerCase();
  if (isOAuthDomain(h)) return true;
  // If any passlist hostname ends with '.h', then h is a parent of an OAuth provider.
  // e.g. 'accounts.google.com'.endsWith('.google.com') → protect 'google.com' cookies.
  for (const host of OAUTH_PASSLIST) {
    if (host.endsWith('.' + h)) return true;
  }
  // Same for suffix-based entries: .okta.com covers okta.com as a parent domain.
  for (const suffix of OAUTH_PASSLIST_SUFFIXES) {
    const bare = suffix.slice(1); // '.okta.com' → 'okta.com'
    if (bare === h || bare.endsWith('.' + h)) return true;
  }
  return false;
}

// ── Consent banner CSS — injected at USER origin (beats all author !important) ──
// User-origin !important cannot be overridden by any author-origin CSS or JS
// inline style, making this immune to CMP re-show loops.
const CONSENT_BANNER_SELECTORS = [
  '#cookie-consent-banner','#cookie-consent','#cookieConsent','#cookie-banner',
  '#cookieBanner','#cookie-notice','#cookieNotice','#cookie-bar','#cookiebar',
  '.cookie-consent-banner','.cookie-consent','.cookie-banner','.cookie-notice','.cookie-bar',
  '[id*="cookie-consent"]','[id*="cookie_consent"]',
  '[class*="cookie-consent"]','[class*="cookie_consent"]',
  // OneTrust
  '#onetrust-consent-sdk','#onetrust-banner-sdk','#onetrust-pc-sdk','#onetrust-pc-btn-handler',
  '#ot-sdk-btn-floating','.ot-floating-button','#ot-floating-button__open',
  // CookieBot
  '#CybotCookiebotDialog','#CybotCookiebotDialogBodyUnderlay',
  // CookieYes
  '#cookie-law-info-bar','#cky-consent','.cky-consent-container',
  '#cky-btn-revisit','.cky-btn-revisit',
  // Quantcast
  '#qc-cmp2-container','#qc-cmp2-ui',
  // SourcePoint
  '.sp-message-container',
  // Didomi
  '.didomi-popup-container','#didomi-host',
  // Usercentrics
  '#usercentrics-root',
  // cc-cookie
  '.cc-window','#cc--main','#cookiebanner',
  // TrustArc
  '#truste-consent-track','#truste-show-consent','#truste-frame',
  '#consent_blackbar','.truste_overlay','.truste_box_overlay',
  // Ketch — banner + inner light-DOM children
  'ketch-consent','#ketch-consent','#ketch-banner','#ketch-consent-banner',
  '[id*="ketch"]','[class*="ketch-module"]','[class*="ketch-consent"]',
  // Shopify Customer Privacy
  'shopify-pc-banner','#shopify-pc-banner','#shopify-pc__banner',
  '#shopify-pc-modal','#shopify-pc__modal','shopify-consent-tracking-api',
  '[id*="shopify-pc"]','[id*="shopify-pc__"]','[class*="shopify-pc"]',
  // Termly
  '#termly-code-snippet-support','[id*="termly"]',
  // Evidon / Ghostery
  '#_evidon_banner','#evidon-barrier-overlay','.evidon-banner',
  // Iubenda
  '#iubenda-cs-banner','.iubenda-cs-container','[id*="iubenda"]',
  // Osano
  '.osano-cm-window','.osano-cm-dialog','#osano-cm-window',
  // Complianz
  '#cmplz-cookiebanner-container','.cmplz-cookiebanner',
  // Moove GDPR
  '#moove_gdpr_cookie_modal','#moove_gdpr_cookie_info_bar',
  // Borlabs
  '#BorlabsCookie','.borlabs-cookie',
  // CookieHub
  '#ch2','.ch2-container','#cookiehub',
  // Civic
  '#ccc','.ccc-alert',
  // Cookie Notice (WP)
  '.cn-notice-container','#cookie-notice-container',
  // Le Monde / custom Didomi
  '[class*="gdpr-lmd"]',
  // Generic catch-alls
  '[id*="privacy-banner"]','[id*="privacy-overlay"]',
  '[id*="consent-banner"]','[id*="consent-modal"]','[id*="consent-dialog"]',
  '[class*="consent-modal"]','[class*="consent-dialog"]','[class*="consent-overlay"]',
  '[class*="consent-popup"]',
  '[class*="cookie-modal"]','[class*="cookie-overlay"]','[class*="cookie-popup"]',
  '[class*="cookie-banner"]','[class*="cookie-wall"]',
  '[id*="gdpr"]','[class*="gdpr"]',
  // Twitch / generic consent-banner class pattern
  '[class*="consent-banner"]',
  // Cookie settings / preference panels (H&M and others)
  '[id*="cookie-settings"]','[class*="cookie-settings"]',
  '[id*="cookie-preference"]','[class*="cookie-preference"]',
  '[id*="cookie-pref"]','[class*="cookie-pref"]',
  '[id*="privacy-preference"]','[class*="privacy-preference"]',
  '[class*="privacy-banner"]','[class*="privacy-overlay"]',
  // Manage-cookies floating buttons
  '[class*="manage-cookies"]','[id*="manage-cookies"]',
  '[class*="manage-consent"]','[id*="manage-consent"]',
  // Amazon
  '#sp-cc','#sp-cc-reallow-btn','.sp-cc','[id*="sp-cc"]',
  // YouTube consent bump
  'ytd-consent-bump-v2-renderer',
  '#consent-bump',
  '[id*="consent-bump"]',
  '[class*="consent-bump"]',
];

const HIDE_PROPS = 'display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;';
const CONSENT_BANNER_CSS =
  CONSENT_BANNER_SELECTORS.join(',\n') + '{' + HIDE_PROPS + '}\n' +
  CONSENT_BANNER_SELECTORS.map(s => ':root ' + s).join(',\n') + '{' + HIDE_PROPS + '}';

async function injectConsentCSS(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      css: CONSENT_BANNER_CSS,
      origin: 'USER',
    });
  } catch (_) { /* tab may not be injectable (chrome://, extension pages, etc.) */ }
}

// ── Per-tab blocked-cookie counts (in-memory, cleared on navigation) ──────
const tabBlockedCounts = new Map();

function updateBadge(tabId, count) {
  if (!tabId) return;
  const text = count > 0 ? (count > 999 ? '999+' : String(count)) : '';
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#665747', tabId });
}

function incrementBadge(tabId, amount) {
  if (!tabId || !amount) return;
  const prev = tabBlockedCounts.get(tabId) || 0;
  const next = prev + amount;
  tabBlockedCounts.set(tabId, next);
  updateBadge(tabId, next);
}

function clearBadge(tabId) {
  tabBlockedCounts.delete(tabId);
  try { updateBadge(tabId, 0); } catch (_) {}
}

// ── Storage helpers (prefs + customRules use sync; logs stay local) ────────
async function getPrefs() {
  try {
    const sync = await chrome.storage.sync.get('preferences');
    if (sync.preferences) return CookiePrefs.mergePrefs(sync.preferences);
    const local = await chrome.storage.local.get('preferences');
    if (local.preferences) {
      await chrome.storage.sync.set({ preferences: local.preferences });
    }
    return CookiePrefs.mergePrefs(local.preferences);
  } catch {
    return CookiePrefs.mergePrefs(null);
  }
}

async function getCustomRules() {
  try {
    const sync = await chrome.storage.sync.get('customRules');
    if (sync.customRules) return sync.customRules;
    const local = await chrome.storage.local.get('customRules');
    if (local.customRules) {
      await chrome.storage.sync.set({ customRules: local.customRules });
    }
    return local.customRules || { domains: [], maxAgeDays: null, blockedPatterns: [] };
  } catch {
    return { domains: [], maxAgeDays: null, blockedPatterns: [] };
  }
}

async function getPausedDomains() {
  try {
    const data = await chrome.storage.sync.get('pausedDomains');
    return new Set(data.pausedDomains || []);
  } catch {
    return new Set();
  }
}

async function setPausedDomains(set) {
  await chrome.storage.sync.set({ pausedDomains: [...set] });
}

// ── Cookie helpers ─────────────────────────────────────────────────────────
async function getClassifiedCookies(url) {
  try {
    const urlObj = new URL(url);
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map(c => ({
      ...c,
      classification: CookieClassifier.classifyCookie(c, urlObj.hostname),
    }));
  } catch {
    return [];
  }
}

async function removeCookie(cookie) {
  const scheme = cookie.secure ? 'https' : 'http';
  const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
  const result = await chrome.cookies.remove({ url: `${scheme}://${domain}${cookie.path}`, name: cookie.name });
  return result !== null;
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + escaped + '$', 'i');
}

// Returns false to block, true to allow, null to fall back to global prefs.
function checkCustomRules(cookie, hostname, category, rules) {
  if (rules.blockedPatterns?.length) {
    for (const p of rules.blockedPatterns) {
      if (patternToRegex(p).test(cookie.name)) return false;
    }
  }
  if (rules.maxAgeDays !== null && cookie.expirationDate) {
    const maxMs = rules.maxAgeDays * 86400 * 1000;
    if (cookie.expirationDate * 1000 - Date.now() > maxMs) return false;
  }
  if (rules.domains?.length) {
    const rule = rules.domains.find(d => hostname === d.domain || hostname.endsWith('.' + d.domain));
    if (rule?.overrides?.[category] !== undefined) return rule.overrides[category];
  }
  return null;
}

async function appendBlockedLog(entries) {
  if (!entries.length) return;
  const data = await chrome.storage.local.get('blockedLog');
  const log = data.blockedLog || [];
  log.push(...entries);
  if (log.length > 50000) log.splice(0, log.length - 50000);
  await chrome.storage.local.set({ blockedLog: log });
}

// ── Core apply logic ───────────────────────────────────────────────────────
async function applyPreferences(url, tabId) {
  if (!url?.startsWith('http')) return;
  try {
    const urlObj = new URL(url);
    if (isOAuthDomain(urlObj.hostname)) return;

    const [prefs, rules, paused] = await Promise.all([getPrefs(), getCustomRules(), getPausedDomains()]);
    if (!prefs.autoApply) return;

    if (paused.has(urlObj.hostname)) return;

    const cookies = await getClassifiedCookies(url);
    const blocked = [];

    for (const cookie of cookies) {
      const { category } = cookie.classification;
      const custom = checkCustomRules(cookie, urlObj.hostname, category, rules);
      let allowed;
      if (custom !== null) {
        allowed = custom;
      } else if (prefs.mode === 'simple') {
        const needed = CookieClassifier.isNecessaryCategory(category);
        allowed = needed ? prefs.simple.necessary : prefs.simple.optional;
      } else {
        allowed = prefs.categories[category] !== false;
      }

      if (!allowed) {
        const removed = await removeCookie(cookie);
        if (removed) {
          blocked.push({ ts: Date.now(), domain: urlObj.hostname, category });
        }
      }
    }

    if (blocked.length) {
      await appendBlockedLog(blocked);
      incrementBadge(tabId, blocked.length);
    }
  } catch {
    // silently skip non-http URLs or permission errors
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({ preferences: CookiePrefs.DEFAULT_PREFS });
    chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
  }
});

// ── Tab events ─────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    clearBadge(tabId);
  }
  if (changeInfo.status === 'complete' && tab.url) {
    let oauthPage = false;
    try { oauthPage = isOAuthDomain(new URL(tab.url).hostname); } catch (_) {}
    if (!oauthPage) {
      applyPreferences(tab.url, tabId);
      if (tab.url.startsWith('http')) injectConsentCSS(tabId);
    }
  }
});

// ── Consent CSS injection via webNavigation ────────────────────────────────
// onCommitted fires when Chrome commits a navigation — the document object
// exists but no HTML has been parsed yet. This is the earliest point at which
// insertCSS can succeed, giving USER-origin rules priority over everything
// the page loads afterwards.
chrome.webNavigation.onCommitted.addListener(({ tabId, url, frameId }) => {
  if (frameId !== 0) return; // main frame only
  if (!url.startsWith('http')) return;
  try { if (isOAuthDomain(new URL(url).hostname)) return; } catch (_) { return; }
  injectConsentCSS(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlockedCounts.delete(tabId);
});

// ── Real-time cookie interception ──────────────────────────────────────────
chrome.cookies.onChanged.addListener(async ({ removed, cookie, cause }) => {
  if (removed) return;
  if (cause === 'expired' || cause === 'expired_overwrite' || cause === 'evicted') return;

  try {
    const [prefs, rules, paused] = await Promise.all([getPrefs(), getCustomRules(), getPausedDomains()]);
    if (!prefs.autoApply) return;

    const domain = cookie.domain.replace(/^\./, '');
    if (isOAuthCookieDomain(domain)) return;
    if (paused.has(domain)) return;

    const classification = CookieClassifier.classifyCookie(cookie, domain);
    const { category } = classification;

    const custom = checkCustomRules(cookie, domain, category, rules);
    let allowed;
    if (custom !== null) {
      allowed = custom;
    } else if (prefs.mode === 'simple') {
      const needed = CookieClassifier.isNecessaryCategory(category);
      allowed = needed ? prefs.simple.necessary : prefs.simple.optional;
    } else {
      allowed = prefs.categories[category] !== false;
    }

    if (!allowed) {
      const removed = await removeCookie(cookie);
      if (removed) {
        await appendBlockedLog([{ ts: Date.now(), domain, category }]);
        // Update badge for any active tab on this domain
        const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
        for (const t of tabs) incrementBadge(t.id, 1);
      }
    }
  } catch {
    // best-effort — ignore errors
  }
});

// ── Message handlers ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.type) {
    case 'GET_COOKIES':
      getClassifiedCookies(msg.url).then(cookies => reply({ cookies }));
      return true;

    case 'DELETE_COOKIE':
      removeCookie(msg.cookie).then(ok => reply({ ok }));
      return true;

    case 'DELETE_CATEGORY':
      getClassifiedCookies(msg.url).then(async cookies => {
        const targets = cookies.filter(c => c.classification.category === msg.category);
        let removed = 0;
        for (const c of targets) {
          if (await removeCookie(c)) removed++;
        }
        reply({ count: targets.length, removed });
      });
      return true;

    case 'GET_TAB':
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => reply({ tab: tab || null }));
      return true;

    case 'APPLY_PREFS':
      applyPreferences(msg.url, msg.tabId).then(() => reply({ ok: true }));
      return true;

    case 'GET_TAB_BLOCKED_COUNT':
      reply({ count: tabBlockedCounts.get(msg.tabId) || 0 });
      return false;

    case 'PAUSE_DOMAIN':
      getPausedDomains().then(async set => {
        set.add(msg.domain);
        await setPausedDomains(set);
        reply({ ok: true });
      });
      return true;

    case 'RESUME_DOMAIN':
      getPausedDomains().then(async set => {
        set.delete(msg.domain);
        await setPausedDomains(set);
        reply({ ok: true });
      });
      return true;

    case 'GET_PAUSED_DOMAINS':
      getPausedDomains().then(set => reply({ domains: [...set] }));
      return true;
  }
});
