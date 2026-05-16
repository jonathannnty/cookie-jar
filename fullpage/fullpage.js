'use strict';

const ALL_CATS = [
  'session','authentication','tracking','third-party',
  'analytics','advertising','functional','unknown'
];
const GLASS_HEIGHT = 641;
let currentPrefs = null;

function updateMilkLevel() {
  if (!currentPrefs) return;
  const enabled = ALL_CATS.filter(c => currentPrefs.categories[c] !== false).length;
  const ty = GLASS_HEIGHT * (1 - enabled / ALL_CATS.length);
  const rect = document.getElementById('milk-fill-rect');
  if (rect) {
    rect.style.transition = 'transform 0.65s cubic-bezier(0.34,1.2,0.64,1)';
    rect.setAttribute('transform', `translate(0,${ty})`);
  }
}

async function loadAndSync() {
  const data = await chrome.storage.local.get('preferences');
  currentPrefs = CookiePrefs.mergePrefs(data.preferences);
  updateMilkLevel();
}

document.getElementById('btnBack')?.addEventListener('click', () => window.close());
document.getElementById('btnSettings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage?.();
});

loadAndSync();
