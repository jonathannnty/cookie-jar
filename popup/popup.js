'use strict';

const COOKIE_INFO = {
  session: {
    body: 'Session cookies are temporary cookies that help websites remember you while you browse — like keeping your cart full or staying logged in. Close your browser and poof, they\'re gone.',
  },
  authentication: {
    body: 'Auth cookies keep you signed in between pages so you don\'t have to type your password all over again. Think of them as a little "yep, it\'s you" note the site holds onto.',
  },
  tracking: {
    body: 'Tracking cookies follow your trail across different websites to build a picture of what you\'re into. They note what you click and how long you stay — then share that with ad networks.',
  },
  'third-party': {
    body: 'Third-party cookies come from other domains — like social share buttons or embedded videos — not the site you\'re actually on. They can quietly track your browsing across many sites at once.',
  },
  analytics: {
    body: 'Analytics cookies help sites figure out which pages people love, where they drop off, and how long they hang around. Usually pretty harmless, but they can still build a fuzzy picture of who you are.',
  },
  advertising: {
    body: 'Advertising cookies are what make ads follow you around the internet. They log your browsing history and measure ad clicks — then that info gets spread across hundreds of ad networks.',
  },
  functional: {
    body: 'Functional cookies remember your preferences — like your language or color theme — so you don\'t have to reconfigure things every visit. Low risk, just a little memory of how you like things.',
  },
  necessary: {
    body: 'Necessary cookies are the ones that keep a website running at all. They handle logins, page navigation, and form submissions. Without them, the site would basically break.',
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
  for (const [id, cat] of Object.entries(TOGGLE_CATS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.checked = currentPrefs.categories[cat] !== false;
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
    currentPrefs.categories[cat] = el.checked;
    await chrome.storage.local.set({ preferences: currentPrefs });
    if (currentTab?.url) await bg({ type: 'APPLY_PREFS', url: currentTab.url });
    toast(el.checked ? `${cat} allowed` : `${cat} blocked`);
  });
});

// ── Info popover (hover-triggered) ────────────────────
const popover  = document.getElementById('infoPopover');
const infoBody = document.getElementById('infoBody');
let   hideTimer = null;

function showPopover(cat, btn) {
  const info = COOKIE_INFO[cat];
  if (!info) return;
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

  infoBody.textContent = info.body;

  // Park off-screen so the browser lays out the popover before we measure it.
  // The fade-in transition begins here; by the time a frame is painted the
  // opacity is still ~0, so there is no visible jump.
  popover.style.top = '-9999px';
  popover.classList.add('visible');

  requestAnimationFrame(() => {
    const row   = btn.closest('.toggle-row');
    const rect  = row.getBoundingClientRect();
    const popH  = popover.offsetHeight;
    const viewH = window.innerHeight;
    const GAP   = 6;

    // Prefer below the row; flip above if it would overflow the bottom edge.
    let top = rect.bottom + GAP;
    if (top + popH > viewH - 4) {
      top = rect.top - popH - GAP;
    }

    // Hard clamp — never clip against the top or bottom of the popup window.
    top = Math.max(4, Math.min(top, viewH - popH - 4));

    popover.style.top = top + 'px';
  });
}

function hidePopover() {
  hideTimer = setTimeout(() => {
    popover.classList.remove('visible');
    hideTimer = null;
  }, 80);
}

document.querySelectorAll('.info-btn').forEach(btn => {
  btn.addEventListener('mouseenter', () => showPopover(btn.dataset.cat, btn));
  btn.addEventListener('mouseleave', hidePopover);
});

// ── Settings modal ─────────────────────────────────────
const settingsOverlay = document.getElementById('settingsOverlay');

document.getElementById('btnSettings')?.addEventListener('click', () => {
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
document.getElementById('btnFullPage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.startsWith('http')) {
    await chrome.storage.local.set({ _originTabUrl: tab.url });
  }
  chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
});

// ── Boot ───────────────────────────────────────────────
(async () => {
  await loadPrefs();
  syncMainToggles();
})();
