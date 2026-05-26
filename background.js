'use strict';

importScripts('./utils/cookie-classifier.js');
importScripts('./utils/prefs.js');

async function getPrefs() {
  const data = await chrome.storage.local.get('preferences');
  return CookiePrefs.mergePrefs(data.preferences);
}

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

async function getCustomRules() {
  const data = await chrome.storage.local.get('customRules');
  return data.customRules || { domains: [], maxAgeDays: null, blockedPatterns: [] };
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

async function applyPreferences(url) {
  if (!url?.startsWith('http')) return;
  try {
    const [prefs, rules] = await Promise.all([getPrefs(), getCustomRules()]);
    if (!prefs.autoApply) return;

    const urlObj = new URL(url);
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
        } else {
          console.warn(`[Cookie Jar] Failed to remove "${cookie.name}" on ${cookie.domain}`);
        }
      }
    }

    await appendBlockedLog(blocked);
  } catch {
    // silently skip non-http URLs or permission errors
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ preferences: CookiePrefs.DEFAULT_PREFS });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    applyPreferences(tab.url);
  }
});

chrome.cookies.onChanged.addListener(async ({ removed, cookie, cause }) => {
  if (removed) return;
  if (cause === 'expired' || cause === 'expired_overwrite' || cause === 'evicted') return;

  try {
    const [prefs, rules] = await Promise.all([getPrefs(), getCustomRules()]);
    if (!prefs.autoApply) return;

    const domain = cookie.domain.replace(/^\./, '');
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
      await removeCookie(cookie);
      await appendBlockedLog([{ ts: Date.now(), domain: cookie.domain.replace(/^\./, ''), category }]);
    }
  } catch {
    // best-effort — ignore errors
  }
});

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
      applyPreferences(msg.url).then(() => reply({ ok: true }));
      return true;
  }
});
