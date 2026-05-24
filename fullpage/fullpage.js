'use strict';

const ALL_CATS = [
  'session','authentication','tracking','third-party',
  'analytics','advertising','functional','unknown'
];
const MILK_FILES = [
  null,
  'Milk-1-8',
  'Milk-2-8',
  'Milk-3-8',
  'Milk-4-8',
  'Milk-5-8',
  'Milk6-8',
  'Milk-7-8',
  'Milk-FULL',
];
let currentPrefs = null;

function updateMilkLevel() {
  if (!currentPrefs) return;
  const enabled = ALL_CATS.filter(c => currentPrefs.categories[c] !== false).length;
  const img = document.getElementById('milkLevelImg');
  if (!img) return;
  const file = MILK_FILES[enabled];
  if (!file) {
    img.style.display = 'none';
  } else {
    img.src = `../figma/svg/${file}.svg`;
    img.style.display = '';
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
