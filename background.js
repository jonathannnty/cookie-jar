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

      if (!allowed) {
        const removed = await removeCookie(cookie);
        if (!removed) {
          console.warn(`[Cookie Jar] Failed to remove "${cookie.name}" on ${cookie.domain} — check domain/path match`);
        }
      }
    }
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
    const prefs = await getPrefs();
    if (!prefs.autoApply) return;

    const domain = cookie.domain.replace(/^\./, '');
    const classification = CookieClassifier.classifyCookie(cookie, domain);
    const { category } = classification;

    let allowed;
    if (prefs.mode === 'simple') {
      const needed = CookieClassifier.isNecessaryCategory(category);
      allowed = needed ? prefs.simple.necessary : prefs.simple.optional;
    } else {
      allowed = prefs.categories[category] !== false;
    }

    if (!allowed) await removeCookie(cookie);
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
