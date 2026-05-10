'use strict';

// Cookie info descriptions (matches ModalPopup-1.png style)
const COOKIE_INFO = {
  session: {
    title: 'Session Cookies',
    body: 'Session cookies are temporary cookies that help websites remember you while you use them — like keeping you logged in or saving your cart. They disappear once you close your browser.',
  },
  authentication: {
    title: 'Auth Cookies',
    body: 'Authentication cookies verify your identity and keep you signed in between page visits. Without them you\'d need to re-enter your password on every page. Theft of these cookies can allow attackers to access your account without a password.',
  },
  tracking: {
    title: 'Tracking Cookies',
    body: 'Tracking cookies follow your activity across websites to build advertising profiles about you. They record which pages you visit, what you click, and how long you stay — often shared with ad networks and data brokers.',
  },
  'third-party': {
    title: 'Third-Party Cookies',
    body: 'Third-party cookies are set by a different domain than the site you\'re currently on — like embedded social buttons, videos, or ad networks. They can track your browsing across many different websites simultaneously.',
  },
  analytics: {
    title: 'Analytics Cookies',
    body: 'Analytics cookies measure how visitors use a website — which pages are popular, where people drop off, and how long they stay. While generally less harmful, this data can still identify you when combined with other information.',
  },
  advertising: {
    title: 'Advertising Cookies',
    body: 'Advertising cookies deliver targeted ads based on your browsing history and measure whether you clicked on an ad. They are often shared across hundreds of advertising networks.',
  },
  functional: {
    title: 'Functional Cookies',
    body: 'Functional cookies save your preferences — like your language, theme, or font size — so you don\'t have to reset them every visit. Generally low-risk, though they can persist as a fingerprint.',
  },
  necessary: {
    title: 'Necessary Cookies',
    body: 'Necessary cookies are required for the website to function at all. They enable core features like page navigation, secure areas, and form submission. They cannot be disabled without breaking the site.',
  },
};

// Map popup toggle IDs to category names
const TOGGLE_CATS = {
  'tog-session':    'session',
  'tog-auth':       'authentication',
  'tog-tracking':   'tracking',
  'tog-thirdparty': 'third-party',
};

let currentPrefs = null;
let currentTab   = null;

// ── Helpers ────────────────────────────────────────────
function bg(msg) {
  return new Promise(res => chrome.runtime.sendMessage(msg, res));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Preferences ────────────────────────────────────────
async function loadPrefs() {
  const data = await chrome.storage.local.get('preferences');
  currentPrefs = CookiePrefs.mergePrefs(data.preferences);
}

// ── Apply prefs to main toggles ────────────────────────
function syncMainToggles() {
  const mode = currentPrefs.mode;

  for (const [id, cat] of Object.entries(TOGGLE_CATS)) {
    const el = document.getElementById(id);
    if (!el) continue;

    if (mode === 'simple') {
      const isNecessary = CookieClassifier.isNecessaryCategory(cat);
      el.checked = isNecessary
        ? currentPrefs.simple.necessary !== false
        : currentPrefs.simple.optional === true;
    } else {
      el.checked = currentPrefs.categories[cat] !== false;
    }
  }
}

// ── Apply prefs to settings modal toggles ─────────────
function syncSettingsToggles() {
  document.querySelectorAll('.settings-toggle input[data-cat]').forEach(input => {
    const cat = input.dataset.cat;
    input.checked = currentPrefs.categories[cat] !== false;
  });
}

// ── Load current tab info ──────────────────────────────
async function loadTabInfo() {
  const { tab } = await bg({ type: 'GET_TAB' });
  currentTab = tab;

  const label = document.getElementById('siteLabel');
  if (!tab?.url?.startsWith('http')) {
    label.textContent = 'Not available on this page';
    return;
  }

  try {
    const url = new URL(tab.url);
    const { cookies } = await bg({ type: 'GET_COOKIES', url: tab.url });
    const counts = CookieClassifier.countByGroup(cookies || []);
    label.textContent = `${url.hostname} · ${counts.total} cookie${counts.total === 1 ? '' : 's'} (${counts.necessary} necessary, ${counts.optional} optional)`;
  } catch {
    label.textContent = '';
  }
}

// ── Main toggle changes → update prefs immediately ─────
Object.keys(TOGGLE_CATS).forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', async () => {
    const cat = TOGGLE_CATS[id];
    const isOptional = !CookieClassifier.isNecessaryCategory(cat);

    if (currentPrefs.mode === 'simple' && isOptional) {
      currentPrefs.simple.optional = el.checked;
      // Keep the other optional toggle in sync visually
      for (const [otherId, otherCat] of Object.entries(TOGGLE_CATS)) {
        if (otherId !== id && !CookieClassifier.isNecessaryCategory(otherCat)) {
          const other = document.getElementById(otherId);
          if (other) other.checked = el.checked;
        }
      }
    } else if (currentPrefs.mode !== 'simple') {
      currentPrefs.categories[cat] = el.checked;
    }
    // In simple mode, necessary toggles are informational — no state change needed.

    await chrome.storage.local.set({ preferences: currentPrefs });
    if (currentTab?.url) await bg({ type: 'APPLY_PREFS', url: currentTab.url });
    toast(el.checked ? `${COOKIE_INFO[cat]?.title || cat} allowed` : `${COOKIE_INFO[cat]?.title || cat} blocked`);
  });
});

// ── Info popover ───────────────────────────────────────
const popover    = document.getElementById('infoPopover');
const infoTitle  = document.getElementById('infoTitle');
const infoBody   = document.getElementById('infoBody');
const infoClose  = document.getElementById('infoClose');
let   activeInfo = null;

document.querySelectorAll('.info-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const cat = btn.dataset.cat;

    if (activeInfo === cat && popover.classList.contains('visible')) {
      popover.classList.remove('visible');
      activeInfo = null;
      return;
    }

    const info = COOKIE_INFO[cat];
    if (!info) return;
    infoTitle.textContent = info.title;
    infoBody.textContent  = info.body;

    // Position below the toggle row
    const row    = btn.closest('.toggle-row');
    const body   = document.getElementById('widgetBody');
    const rowTop = row.offsetTop + row.offsetHeight + body.offsetTop;
    popover.style.top = rowTop + 'px';

    popover.classList.add('visible');
    activeInfo = cat;
  });
});

infoClose.addEventListener('click', () => {
  popover.classList.remove('visible');
  activeInfo = null;
});

// Close popover on outside click
document.addEventListener('click', e => {
  if (!popover.contains(e.target) && !e.target.closest('.info-btn')) {
    popover.classList.remove('visible');
    activeInfo = null;
  }
});

// ── Settings modal ─────────────────────────────────────
const settingsOverlay = document.getElementById('settingsOverlay');

document.getElementById('btnSettings').addEventListener('click', () => {
  syncSettingsToggles();
  settingsOverlay.classList.add('visible');
  popover.classList.remove('visible');
});

document.getElementById('btnSettingsCancel').addEventListener('click', () => {
  settingsOverlay.classList.remove('visible');
  syncMainToggles(); // revert visual
});

document.getElementById('btnSettingsSave').addEventListener('click', async () => {
  // Collect settings modal values
  document.querySelectorAll('.settings-toggle input[data-cat]').forEach(input => {
    currentPrefs.categories[input.dataset.cat] = input.checked;
  });

  await chrome.storage.local.set({ preferences: currentPrefs });
  if (currentTab?.url) await bg({ type: 'APPLY_PREFS', url: currentTab.url });

  settingsOverlay.classList.remove('visible');
  syncMainToggles();
  toast('Preferences saved ✓');
});

// ── Advanced settings toggle ───────────────────────────
const advBtn     = document.getElementById('advancedToggleBtn');
const advSection = document.getElementById('advancedSection');

advBtn.addEventListener('click', () => {
  const open = advSection.classList.toggle('open');
  advBtn.classList.toggle('open', open);
});

// ── Full page link ─────────────────────────────────────
document.getElementById('btnFullPage').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
});

// ── Boot ───────────────────────────────────────────────
(async () => {
  await loadPrefs();
  syncMainToggles();
  await loadTabInfo();
})();
