'use strict';

importScripts('./utils/cookie-classifier.js');

const DEFAULT_PREFS = {
  mode: 'simple',
  onboardingComplete: false,
  autoApply: true,
  categories: {
    necessary: true,
    session: true,
    authentication: true,
    tracking: false,
    advertising: false,
    analytics: false,
    functional: true,
    'third-party': false,
    unknown: false,
  },
  simple: {
    necessary: true,
    optional: false,
  },
};

async function getPrefs() {
  const data = await chrome.storage.local.get('preferences');
  return Object.assign({}, DEFAULT_PREFS, data.preferences, {
    categories: Object.assign({}, DEFAULT_PREFS.categories, data.preferences?.categories),
    simple: Object.assign({}, DEFAULT_PREFS.simple, data.preferences?.simple),
  });
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
  return chrome.cookies.remove({ url: `${scheme}://${domain}${cookie.path}`, name: cookie.name });
}

async function applyPreferences(url) {
  if (!url?.startsWith('http')) return;
  try {
    const prefs = await getPrefs();
    if (!prefs.autoApply) return;

    const cookies = await getClassifiedCookies(url);
    for (const cookie of cookies) {
      const { category } = cookie.classification;
      let allowed;

      if (prefs.mode === 'simple') {
        const needed = CookieClassifier.isNecessaryCategory(category);
        allowed = needed ? prefs.simple.necessary : prefs.simple.optional;
      } else {
        allowed = prefs.categories[category] !== false;
      }

      if (!allowed) await removeCookie(cookie);
    }
  } catch {
    // silently skip non-http URLs or permission errors
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ preferences: DEFAULT_PREFS });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    applyPreferences(tab.url);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.type) {
    case 'GET_COOKIES':
      getClassifiedCookies(msg.url).then(cookies => reply({ cookies }));
      return true;

    case 'DELETE_COOKIE':
      removeCookie(msg.cookie).then(() => reply({ ok: true }));
      return true;

    case 'DELETE_CATEGORY':
      getClassifiedCookies(msg.url).then(async cookies => {
        const targets = cookies.filter(c => c.classification.category === msg.category);
        for (const c of targets) await removeCookie(c);
        reply({ count: targets.length });
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
