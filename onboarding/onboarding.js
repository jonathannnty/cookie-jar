'use strict';

const CARD_ORDER = [
  'session', 'authentication', 'necessary',
  'tracking', 'advertising', 'analytics',
  'functional', 'third-party', 'unknown',
];

// Render educational cards
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  CARD_ORDER.forEach(id => {
    const cat = CookieClassifier.CATEGORIES[id];
    if (!cat) return;

    const bgColor = id === 'necessary' ? '#EBF5EC'
      : id === 'session' ? '#EBF3FA'
      : id === 'authentication' ? '#F3EEF8'
      : id === 'tracking' || id === 'advertising' ? '#FDECEA'
      : id === 'analytics' ? '#FDF0E8'
      : id === 'functional' ? '#E8F8F5'
      : id === 'third-party' ? '#FEF5E7'
      : '#F2F3F4';

    const typeLabel = cat.isOptional ? 'Optional' : 'Necessary';
    const typeBg = cat.isOptional ? '#FDECEA' : '#EBF5EC';
    const typeFg = cat.isOptional ? '#C0392B' : '#4A7C4E';

    const card = document.createElement('article');
    card.className = 'cookie-card';
    card.innerHTML = `
      <div class="cookie-card-header">
        <div class="cookie-card-icon" style="background:${bgColor}">${cat.icon}</div>
        <div>
          <div class="cookie-card-name">${cat.label} Cookies</div>
          <span class="cookie-card-type" style="background:${typeBg};color:${typeFg}">${typeLabel}</span>
        </div>
      </div>
      <p class="cookie-card-desc">${cat.description}</p>
      <p class="cookie-card-detail">${cat.detail}</p>
      <div class="cookie-card-lookout">${cat.lookout}</div>
    `;
    grid.appendChild(card);
  });
}

// Mode toggle
let currentMode = 'simple';
const btnSimple   = document.getElementById('btnSimple');
const btnAdvanced = document.getElementById('btnAdvanced');
const simplePrefs   = document.getElementById('simplePrefs');
const advancedPrefs = document.getElementById('advancedPrefs');

function setMode(mode) {
  currentMode = mode;
  btnSimple.classList.toggle('active', mode === 'simple');
  btnAdvanced.classList.toggle('active', mode === 'advanced');
  simplePrefs.classList.toggle('hidden', mode !== 'simple');
  advancedPrefs.classList.toggle('hidden', mode !== 'advanced');
}

btnSimple.addEventListener('click', () => setMode('simple'));
btnAdvanced.addEventListener('click', () => setMode('advanced'));

// Build and save preferences
document.getElementById('saveBtn').addEventListener('click', async () => {
  const prefs = {
    mode: currentMode,
    onboardingComplete: true,
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
      optional: document.getElementById('simpleOptional')?.checked ?? false,
    },
  };

  if (currentMode === 'advanced') {
    document.querySelectorAll('[data-cat]').forEach(input => {
      prefs.categories[input.dataset.cat] = input.checked;
    });
  }

  await chrome.storage.local.set({ preferences: prefs });
  window.close();
});

// Load existing preferences (if user reopens page)
async function loadPrefs() {
  const data = await chrome.storage.local.get('preferences');
  const prefs = data.preferences;
  if (!prefs) return;

  setMode(prefs.mode || 'simple');

  const simpleOpt = document.getElementById('simpleOptional');
  if (simpleOpt) simpleOpt.checked = prefs.simple?.optional ?? false;

  document.querySelectorAll('[data-cat]').forEach(input => {
    const cat = input.dataset.cat;
    if (prefs.categories?.[cat] !== undefined) {
      input.checked = prefs.categories[cat];
    }
  });
}

renderCards();
loadPrefs();
