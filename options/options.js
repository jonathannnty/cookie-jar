'use strict';

const DEFAULT_PREFS = {
  mode: 'simple',
  onboardingComplete: true,
  autoApply: true,
  categories: {
    necessary: true, session: true, authentication: true,
    tracking: false, advertising: false, analytics: false,
    functional: true, 'third-party': false, unknown: false,
  },
  simple: { necessary: true, optional: false },
};

const ADVANCED_DEFS = [
  { cat: 'necessary',     icon: '🔒', bg: '#EBF5EC', required: true,  label: 'Necessary',    desc: 'Core site functionality. Cannot be disabled.' },
  { cat: 'session',       icon: '⏱️', bg: '#EBF3FA', required: false, label: 'Session',      desc: 'Temporary cookies deleted when you close your browser.' },
  { cat: 'authentication',icon: '🔑', bg: '#F3EEF8', required: false, label: 'Authentication',desc: 'Keep you logged in and verify your identity.' },
  { cat: 'functional',    icon: '⚙️', bg: '#E8F8F5', required: false, label: 'Functional',   desc: 'Remember preferences like language, theme, and saved settings.' },
  { cat: 'analytics',     icon: '📊', bg: '#FDF0E8', required: false, label: 'Analytics',    desc: 'Measure site traffic and user behaviour.' },
  { cat: 'tracking',      icon: '👁️', bg: '#FDECEA', required: false, label: 'Tracking',     desc: 'Monitor your behaviour across sites to build ad profiles.' },
  { cat: 'advertising',   icon: '📢', bg: '#FDECEA', required: false, label: 'Advertising',  desc: 'Deliver targeted ads and measure conversions.' },
  { cat: 'third-party',   icon: '🔗', bg: '#FEF5E7', required: false, label: 'Third-party',  desc: 'Set by a different domain than the site you\'re visiting.' },
  { cat: 'unknown',       icon: '❓', bg: '#F2F3F4', required: false, label: 'Unknown',      desc: 'Purpose could not be automatically determined.' },
];

let currentPrefs = { ...DEFAULT_PREFS };

function setStatus(msg, timeout = 0) {
  const el = document.getElementById('saveStatus');
  el.textContent = msg;
  if (timeout) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, timeout);
}

// ── Load ───────────────────────────────────────────────
async function load() {
  const data = await chrome.storage.local.get('preferences');
  currentPrefs = Object.assign({}, DEFAULT_PREFS, data.preferences, {
    categories: Object.assign({}, DEFAULT_PREFS.categories, data.preferences?.categories),
    simple: Object.assign({}, DEFAULT_PREFS.simple, data.preferences?.simple),
  });

  document.getElementById('autoApply').checked = currentPrefs.autoApply !== false;
  document.getElementById('simpleOptional').checked = currentPrefs.simple.optional ?? false;

  setMode(currentPrefs.mode || 'simple', false);
  buildAdvancedRows();
  applySavedToAdvanced();
}

// ── Mode ───────────────────────────────────────────────
function setMode(mode, updatePrefs = true) {
  currentPrefs.mode = mode;
  document.getElementById('modeSimpleCard').classList.toggle('selected', mode === 'simple');
  document.getElementById('modeAdvancedCard').classList.toggle('selected', mode === 'advanced');
  document.getElementById('sectionSimple').classList.toggle('hidden', mode !== 'simple');
  document.getElementById('sectionAdvanced').classList.toggle('hidden', mode !== 'advanced');
  if (updatePrefs) setStatus('Unsaved changes');
}

document.getElementById('modeSimpleCard').addEventListener('click',   () => setMode('simple'));
document.getElementById('modeAdvancedCard').addEventListener('click', () => setMode('advanced'));

// ── Advanced rows ──────────────────────────────────────
function buildAdvancedRows() {
  const container = document.getElementById('advancedRows');
  container.innerHTML = '';

  ADVANCED_DEFS.forEach(({ cat, icon, bg, required, label, desc }) => {
    const row = document.createElement('div');
    row.className = 'pref-row';
    row.innerHTML = `
      <div class="pref-row-info">
        <div class="pref-icon" style="background:${bg}">${icon}</div>
        <div>
          <div class="pref-name">${label}</div>
          <div class="pref-desc">${desc}</div>
          ${required ? '<span class="tag tag-required">Always on</span>' : '<span class="tag tag-optional">Optional</span>'}
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" data-cat="${cat}" ${required ? 'checked disabled' : ''}>
        <span class="toggle-track"></span>
      </label>
    `;
    container.appendChild(row);
  });

  // Listen for changes
  container.querySelectorAll('input[data-cat]:not([disabled])').forEach(input => {
    input.addEventListener('change', () => {
      currentPrefs.categories[input.dataset.cat] = input.checked;
      setStatus('Unsaved changes');
    });
  });
}

function applySavedToAdvanced() {
  document.querySelectorAll('[data-cat]:not([disabled])').forEach(input => {
    const cat = input.dataset.cat;
    if (currentPrefs.categories[cat] !== undefined) {
      input.checked = currentPrefs.categories[cat];
    }
  });
}

// ── Listen for simple changes ──────────────────────────
document.getElementById('autoApply').addEventListener('change', e => {
  currentPrefs.autoApply = e.target.checked;
  setStatus('Unsaved changes');
});
document.getElementById('simpleOptional').addEventListener('change', e => {
  currentPrefs.simple.optional = e.target.checked;
  setStatus('Unsaved changes');
});

// ── Save ───────────────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
  await chrome.storage.local.set({ preferences: currentPrefs });
  setStatus('Saved ✓', 2500);
});

// ── Reset ──────────────────────────────────────────────
document.getElementById('btnReset').addEventListener('click', async () => {
  if (!confirm('Reset all preferences to defaults?')) return;
  currentPrefs = { ...DEFAULT_PREFS, onboardingComplete: true };
  await chrome.storage.local.set({ preferences: currentPrefs });
  load();
  setStatus('Reset to defaults ✓', 2500);
});

load();
