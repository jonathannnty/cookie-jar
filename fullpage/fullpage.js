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
  syncSettingsToggles();
}

// ── Home button: return to info page ──────────────────
document.getElementById('btnHome')?.addEventListener('click', () => {
  let closed = false;
  if (statsVisible) {
    statsVisible = false;
    btnStats?.classList.remove('stats-active');
    statsPanel?.classList.add('fp-hidden');
    closed = true;
  }
  if (customizeVisible) {
    customizeVisible = false;
    btnCustomize?.classList.remove('customize-active');
    customizePanel?.classList.add('fp-hidden');
    closed = true;
  }
  if (closed) {
    mainWrapper?.classList.remove('fp-hidden');
    btnHome?.classList.add('home-active');
  }
});

// ── Back button: return to origin tab ──────────────────
document.getElementById('btnBack')?.addEventListener('click', async () => {
  try {
    const data = await chrome.storage.local.get('_originTabUrl');
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (data._originTabUrl && currentTab?.id) {
      chrome.tabs.update(currentTab.id, { url: data._originTabUrl });
    } else if (currentTab?.id) {
      chrome.tabs.remove(currentTab.id);
    } else {
      window.close();
    }
  } catch {
    window.close();
  }
});

// ── Settings modal ─────────────────────────────────────
const overlay    = document.getElementById('settingsOverlay');
const closeBtn   = document.getElementById('btnSettingsClose');
const advBtn     = document.getElementById('fpAdvBtn');
const advSection = document.getElementById('fpAdvSection');

document.getElementById('btnSettings')?.addEventListener('click', () => {
  overlay?.classList.remove('fp-hidden');
});

closeBtn?.addEventListener('click', () => {
  overlay?.classList.add('fp-hidden');
});

overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) overlay.classList.add('fp-hidden');
});

advBtn?.addEventListener('click', () => {
  const open = advSection.classList.toggle('open');
  advBtn.classList.toggle('open', open);
});

function syncSettingsToggles() {
  if (!currentPrefs) return;
  overlay?.querySelectorAll('.fp-toggle input[data-cat]').forEach(input => {
    const cat = input.dataset.cat;
    input.checked = currentPrefs.categories[cat] !== false;
  });
}

async function onToggleChange(e) {
  if (!currentPrefs) return;
  const cat = e.target.dataset.cat;
  if (!cat) return;
  currentPrefs.categories[cat] = e.target.checked;
  await chrome.storage.local.set({ preferences: currentPrefs });
  updateMilkLevel();
}

overlay?.querySelectorAll('.fp-toggle input[data-cat]').forEach(input => {
  input.addEventListener('change', onToggleChange);
});

loadAndSync();

// ── Stats panel ────────────────────────────────────────
const mainWrapper = document.querySelector('.main-wrapper');
const statsPanel  = document.getElementById('statsPanel');
const btnStats    = document.getElementById('btnStats');
const btnHome     = document.getElementById('btnHome');
btnHome?.classList.add('home-active');
const statsCanvas = document.getElementById('statsCanvas');
const statsEmpty  = document.getElementById('statsEmpty');
const statsCount  = document.getElementById('statsCount');

let statsVisible  = false;
let activeType    = 'bar';
let activePeriod  = 'today';

btnStats?.addEventListener('click', () => {
  statsVisible = !statsVisible;
  btnStats.classList.toggle('stats-active', statsVisible);
  btnHome?.classList.toggle('home-active', !statsVisible);
  mainWrapper?.classList.toggle('fp-hidden', statsVisible);
  statsPanel?.classList.toggle('fp-hidden', !statsVisible);
  if (statsVisible) renderStats();
});

// Period / type button clicks
statsPanel?.querySelectorAll('.stats-type-btns .stats-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    statsPanel.querySelectorAll('.stats-type-btns .stats-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    renderStats();
  });
});

statsPanel?.querySelectorAll('.stats-period-btns .stats-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    statsPanel.querySelectorAll('.stats-period-btns .stats-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePeriod = btn.dataset.period;
    renderStats();
  });
});

// Redraw on resize
if (statsCanvas) {
  new ResizeObserver(() => { if (statsVisible) renderStats(); }).observe(statsCanvas.parentElement);
}

// ── Data helpers ───────────────────────────────────────
function getPeriodStart(period) {
  const now = Date.now();
  const d = new Date();
  switch (period) {
    case 'today': {
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case 'week':  return now - 7  * 86400000;
    case 'month': return now - 30 * 86400000;
    case 'year':  return now - 365 * 86400000;
    default:      return 0;
  }
}

function getFilteredLog(log, period) {
  const start = getPeriodStart(period);
  return log.filter(e => e.ts >= start);
}

function aggregateByDomain(entries) {
  const map = {};
  for (const e of entries) {
    map[e.domain] = (map[e.domain] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([label, value]) => ({ label, value }));
}

function aggregateByTime(entries, period) {
  if (!entries.length) return [];

  const buckets = new Map();

  if (period === 'today') {
    // Bucket by hour (0–23)
    for (let h = 0; h < 24; h++) {
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      buckets.set(h, { label, value: 0 });
    }
    for (const e of entries) {
      const h = new Date(e.ts).getHours();
      buckets.get(h).value++;
    }
  } else if (period === 'week') {
    // Bucket by day (last 7 days)
    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      buckets.set(d.toDateString(), { label: DAY_NAMES[d.getDay()], value: 0 });
    }
    for (const e of entries) {
      const key = new Date(e.ts).toDateString();
      if (buckets.has(key)) buckets.get(key).value++;
    }
  } else if (period === 'month') {
    // Bucket by day (last 30 days, every 3rd labeled)
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const label = i % 5 === 0 ? `${d.getMonth()+1}/${d.getDate()}` : '';
      buckets.set(d.toDateString(), { label, value: 0 });
    }
    for (const e of entries) {
      const key = new Date(e.ts).toDateString();
      if (buckets.has(key)) buckets.get(key).value++;
    }
  } else {
    // year / all — bucket by month
    const now = new Date();
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const count = period === 'year' ? 12 : 24;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, { label: MONTH_NAMES[d.getMonth()], value: 0 });
    }
    for (const e of entries) {
      const d = new Date(e.ts);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(key)) buckets.get(key).value++;
    }
  }

  return Array.from(buckets.values());
}

// ── Canvas chart drawing ───────────────────────────────
const C = {
  fill:    '#a8876a',
  fillAlt: '#c4a48b',
  text:    '#665747',
  grid:    'rgba(102,87,71,0.12)',
  bg:      'transparent',
  accent:  '#7a5c3f',
};

function setupCanvas(canvas) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function drawBarChart(canvas, data) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  if (!data.length) return;

  const maxVal   = Math.max(...data.map(d => d.value), 1);
  const padLeft  = Math.min(160, w * 0.3);
  const padRight = 56;
  const padTop   = 12;
  const padBot   = 16;
  const barArea  = w - padLeft - padRight;
  const rowH     = (h - padTop - padBot) / data.length;
  const barH     = Math.min(rowH * 0.52, 24);

  ctx.font = `500 ${Math.min(13, rowH * 0.45)}px Fredoka, sans-serif`;
  ctx.textBaseline = 'middle';

  data.forEach((d, i) => {
    const y    = padTop + i * rowH + rowH / 2;
    const barW = (d.value / maxVal) * barArea;

    // Domain label
    ctx.fillStyle = C.text;
    ctx.textAlign = 'right';
    const label = d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label;
    ctx.fillText(label, padLeft - 8, y);

    // Bar
    const grad = ctx.createLinearGradient(padLeft, 0, padLeft + barW, 0);
    grad.addColorStop(0, C.fill);
    grad.addColorStop(1, C.fillAlt);
    ctx.fillStyle = grad;
    const r = Math.min(barH / 2, 6);
    roundRect(ctx, padLeft, y - barH / 2, Math.max(barW, r * 2), barH, r);
    ctx.fill();

    // Count label
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.fillText(d.value, padLeft + barW + 6, y);
  });
}

function drawLineChart(canvas, data) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  if (!data.length) return;

  const maxVal  = Math.max(...data.map(d => d.value), 1);
  const padLeft = 40;
  const padRight = 16;
  const padTop   = 16;
  const padBot   = 32;
  const chartW   = w - padLeft - padRight;
  const chartH   = h - padTop - padBot;

  // Grid lines + Y labels
  const ySteps = 4;
  ctx.font = `400 11px Fredoka, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let s = 0; s <= ySteps; s++) {
    const val = Math.round((maxVal / ySteps) * s);
    const y   = padTop + chartH - (s / ySteps) * chartH;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.fillText(val, padLeft - 4, y);
  }

  // Points
  const pts = data.map((d, i) => ({
    x: padLeft + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padTop + chartH - (d.value / maxVal) * chartH,
    value: d.value,
    label: d.label,
  }));

  // Area fill
  const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  areaGrad.addColorStop(0, 'rgba(168,135,106,0.28)');
  areaGrad.addColorStop(1, 'rgba(168,135,106,0.02)');
  ctx.fillStyle = areaGrad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padTop + chartH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padTop + chartH);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = C.fill;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Dots
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle   = '#f4d6be';
    ctx.strokeStyle = C.fill;
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
  });

  // X-axis labels
  ctx.font = `400 11px Fredoka, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  ctx.fillStyle    = C.text;
  const labelEvery = Math.max(1, Math.ceil(pts.length / 10));
  pts.forEach((p, i) => {
    if (data[i].label && i % labelEvery === 0) {
      ctx.fillText(data[i].label, p.x, padTop + chartH + 6);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Customize panel ────────────────────────────────────
const customizePanel   = document.getElementById('customizePanel');
const btnCustomize     = document.getElementById('btnCustomize');
const custRuleCount    = document.getElementById('custRuleCount');
const custDomainInput  = document.getElementById('custDomainInput');
const custAddDomain    = document.getElementById('custAddDomain');
const custPersistToggle = document.getElementById('custPersistToggle');
const custMaxDays      = document.getElementById('custMaxDays');
const custPatternInput = document.getElementById('custPatternInput');
const custAddPattern   = document.getElementById('custAddPattern');

let customizeVisible = false;
let customRules = { domains: [], maxAgeDays: null, blockedPatterns: [] };

const PATTERN_PRESETS = [
  { pattern: '_ga*',   label: 'Google Analytics',         why: 'Tracks sessions, page views, and events on sites using GA4' },
  { pattern: '_gid',   label: 'GA Session',               why: 'Counts you as a unique daily visitor; refreshes every 24 hours' },
  { pattern: '__utm*', label: 'Google UTM Legacy',        why: 'Classic Analytics cookie logging campaign source, medium, and keyword' },
  { pattern: '_fbp',   label: 'Facebook Pixel',           why: 'Meta Pixel tracking cookie placed on all partner sites' },
  { pattern: 'fr',     label: 'Facebook Advertising',     why: 'Stores a browser ID for ad targeting and frequency capping on Facebook' },
  { pattern: 'IDE',    label: 'Google DoubleClick',       why: 'Records and measures clicks on display ads across Google's ad network' },
  { pattern: '_tt_*',  label: 'TikTok Tracking',          why: 'TikTok's event cookie that measures ad conversion from campaigns' },
  { pattern: 'MUID',   label: 'Microsoft Advertising',    why: 'Cross-site user ID for ad targeting on Bing, MSN, and partner sites' },
];

const CAT_LABELS = {
  session: 'Session', authentication: 'Auth', tracking: 'Tracking',
  'third-party': '3rd Party', analytics: 'Analytics', advertising: 'Ads',
  functional: 'Functional', unknown: 'Unknown',
};

btnCustomize?.addEventListener('click', () => {
  if (statsVisible) {
    statsVisible = false;
    btnStats?.classList.remove('stats-active');
    mainWrapper?.classList.remove('fp-hidden');
    statsPanel?.classList.add('fp-hidden');
  }
  customizeVisible = !customizeVisible;
  btnCustomize.classList.toggle('customize-active', customizeVisible);
  btnHome?.classList.toggle('home-active', !customizeVisible);
  mainWrapper?.classList.toggle('fp-hidden', customizeVisible);
  customizePanel?.classList.toggle('fp-hidden', !customizeVisible);
  if (customizeVisible) renderCustomize();
});

async function loadCustomRules() {
  const data = await chrome.storage.local.get('customRules');
  customRules = data.customRules || { domains: [], maxAgeDays: null, blockedPatterns: [] };
  updateCustRuleCount();
}

async function saveCustomRules() {
  await chrome.storage.local.set({ customRules });
  updateCustRuleCount();
}

function updateCustRuleCount() {
  if (!custRuleCount) return;
  const n = customRules.domains.length +
    (customRules.maxAgeDays !== null ? 1 : 0) +
    customRules.blockedPatterns.length;
  custRuleCount.textContent = `${n} rule${n === 1 ? '' : 's'} active`;
}

function renderPresets() {
  const container = document.getElementById('custPresets');
  if (!container) return;
  container.innerHTML = '';
  PATTERN_PRESETS.forEach(p => {
    const active = customRules.blockedPatterns.includes(p.pattern);
    const item = document.createElement('div');
    item.className = 'cust-preset-item' + (active ? ' active' : '');
    item.innerHTML = `
      <div class="cust-preset-check"><div class="cust-preset-check-inner"></div></div>
      <div class="cust-preset-text">
        <span class="cust-preset-name">${p.label}</span><code class="cust-preset-pattern">${p.pattern}</code>
        <p class="cust-preset-why">${p.why}</p>
      </div>`;
    item.addEventListener('click', async () => {
      const idx = customRules.blockedPatterns.indexOf(p.pattern);
      if (idx >= 0) customRules.blockedPatterns.splice(idx, 1);
      else customRules.blockedPatterns.push(p.pattern);
      await saveCustomRules();
      renderPresets();
    });
    container.appendChild(item);
  });
}

function renderCustomPatterns() {
  const container = document.getElementById('custCustomPatterns');
  if (!container) return;
  const presetSet = new Set(PATTERN_PRESETS.map(p => p.pattern));
  const userPatterns = customRules.blockedPatterns.filter(p => !presetSet.has(p));
  container.innerHTML = '';
  userPatterns.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'cust-pattern-chip';
    chip.innerHTML = `${p} <span class="cust-pattern-chip-remove">×</span>`;
    chip.querySelector('.cust-pattern-chip-remove').addEventListener('click', async e => {
      e.stopPropagation();
      const idx = customRules.blockedPatterns.indexOf(p);
      if (idx >= 0) customRules.blockedPatterns.splice(idx, 1);
      await saveCustomRules();
      renderCustomPatterns();
    });
    container.appendChild(chip);
  });
}

function renderDomainList() {
  const container = document.getElementById('custDomainList');
  if (!container) return;
  container.innerHTML = '';
  customRules.domains.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'cust-domain-item';
    const catsHtml = ALL_CATS.map(cat => {
      const state = rule.overrides[cat];
      const cls = state === true ? 'allow' : state === false ? 'block' : '';
      return `<span class="cust-cat-chip ${cls}" data-cat="${cat}">${CAT_LABELS[cat]}</span>`;
    }).join('');
    item.innerHTML = `
      <div class="cust-domain-header">
        <span class="cust-domain-name">${rule.domain}</span>
        <button class="cust-remove-btn">×</button>
      </div>
      <div class="cust-domain-cats">${catsHtml}</div>
      <p class="cust-domain-hint">Tap a category to cycle: allow (green) → block (red) → inherit global</p>`;
    item.querySelector('.cust-remove-btn').addEventListener('click', async () => {
      customRules.domains.splice(idx, 1);
      await saveCustomRules();
      renderDomainList();
    });
    item.querySelectorAll('.cust-cat-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const cat = chip.dataset.cat;
        const cur = rule.overrides[cat];
        if (cur === undefined) rule.overrides[cat] = true;
        else if (cur === true)  rule.overrides[cat] = false;
        else                    delete rule.overrides[cat];
        await saveCustomRules();
        renderDomainList();
      });
    });
    container.appendChild(item);
  });
}

function renderCustomize() {
  if (custPersistToggle) custPersistToggle.checked = customRules.maxAgeDays !== null;
  if (custMaxDays) {
    custMaxDays.value    = customRules.maxAgeDays ?? 30;
    custMaxDays.disabled = customRules.maxAgeDays === null;
  }
  renderPresets();
  renderCustomPatterns();
  renderDomainList();
  updateCustRuleCount();
}

custAddDomain?.addEventListener('click', async () => {
  const raw = custDomainInput?.value.trim().toLowerCase();
  if (!raw) return;
  const domain = raw.replace(/^https?:\/\//, '').split('/')[0];
  if (!domain || customRules.domains.find(d => d.domain === domain)) return;
  customRules.domains.push({ domain, overrides: {} });
  custDomainInput.value = '';
  await saveCustomRules();
  renderDomainList();
});

custDomainInput?.addEventListener('keydown', e => { if (e.key === 'Enter') custAddDomain?.click(); });

custPersistToggle?.addEventListener('change', async () => {
  customRules.maxAgeDays = custPersistToggle.checked ? (parseInt(custMaxDays?.value) || 30) : null;
  if (custMaxDays) custMaxDays.disabled = !custPersistToggle.checked;
  await saveCustomRules();
});

custMaxDays?.addEventListener('change', async () => {
  if (customRules.maxAgeDays !== null) {
    customRules.maxAgeDays = Math.max(1, parseInt(custMaxDays.value) || 30);
    await saveCustomRules();
  }
});

custAddPattern?.addEventListener('click', async () => {
  const p = custPatternInput?.value.trim();
  if (!p || customRules.blockedPatterns.includes(p)) return;
  customRules.blockedPatterns.push(p);
  custPatternInput.value = '';
  await saveCustomRules();
  renderPresets();
  renderCustomPatterns();
});

custPatternInput?.addEventListener('keydown', e => { if (e.key === 'Enter') custAddPattern?.click(); });

loadCustomRules();

// ── Render orchestrator ────────────────────────────────
async function renderStats() {
  if (!statsCanvas) return;

  const data  = await chrome.storage.local.get('blockedLog');
  const log   = data.blockedLog || [];
  const filtered = getFilteredLog(log, activePeriod);

  statsCount.textContent = `${filtered.length} cookie${filtered.length === 1 ? '' : 's'} blocked`;

  const isEmpty = filtered.length === 0;
  statsEmpty.style.display  = isEmpty ? '' : 'none';
  statsCanvas.style.display = isEmpty ? 'none' : '';

  if (isEmpty) return;

  if (activeType === 'bar') {
    drawBarChart(statsCanvas, aggregateByDomain(filtered));
  } else {
    drawLineChart(statsCanvas, aggregateByTime(filtered, activePeriod));
  }
}
