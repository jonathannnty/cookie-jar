'use strict';

const ALL_CATS = [
  'session','authentication','tracking','third-party',
  'analytics','advertising','functional','unknown'
];
let currentPrefs = null;

async function loadAndSync() {
  try {
    const data = await chrome.storage.sync.get('preferences');
    currentPrefs = CookiePrefs.mergePrefs(data.preferences);
  } catch (e) {
    currentPrefs = CookiePrefs.mergePrefs(null);
  }
  syncSettingsToggles();
}

// ── Central panel switcher ─────────────────────────────
const ALL_PANELS = ['stats', 'customize', 'contact', 'terms', 'privacy'];

function showHome() {
  ALL_PANELS.forEach(id => {
    document.getElementById(id + 'Panel')?.classList.add('fp-hidden');
  });
  statsVisible    = false;
  customizeVisible = false;
  btnStats?.classList.remove('stats-active');
  btnCustomize?.classList.remove('customize-active');
  mainWrapper?.classList.remove('fp-hidden');
  btnHome?.classList.add('home-active');
}

function showPanel(panelId) {
  showHome();
  mainWrapper?.classList.add('fp-hidden');
  btnHome?.classList.remove('home-active');
  document.getElementById(panelId + 'Panel')?.classList.remove('fp-hidden');
  if (panelId === 'stats') {
    statsVisible = true;
    btnStats?.classList.add('stats-active');
    renderStats();
  }
  if (panelId === 'customize') {
    customizeVisible = true;
    btnCustomize?.classList.add('customize-active');
    renderCustomize();
  }
}

// ── Home button: return to info page ──────────────────
document.getElementById('btnHome')?.addEventListener('click', showHome);

// ── Logo/title home button ─────────────────────────────
document.getElementById('btnLogoHome')?.addEventListener('click', showHome);

// ── Footer links ───────────────────────────────────────
document.querySelectorAll('[data-panel]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showPanel(el.dataset.panel);
  });
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

let _toastTimer = null;
function fpToast(msg) {
  const el = document.getElementById('fpToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

async function onToggleChange(e) {
  const cat = e.target.dataset.cat;
  if (!cat) return;
  const label = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ');
  fpToast(e.target.checked ? `${label} allowed` : `${label} blocked`);
  if (!currentPrefs) return;
  currentPrefs.categories[cat] = e.target.checked;
  try { await chrome.storage.sync.set({ preferences: currentPrefs }); } catch (e) { /* unavailable outside extension context */ }
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
  if (statsVisible) { showHome(); return; }
  showPanel('stats');
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

// ── Chart tooltip + hit testing ────────────────────────
let chartHitData = null;
const chartTooltip = document.getElementById('chartTooltip');

function showTooltip(html, cx, cy) {
  if (!chartTooltip) return;
  chartTooltip.innerHTML = html;
  chartTooltip.classList.add('visible');
  const tw = chartTooltip.offsetWidth;
  const th = chartTooltip.offsetHeight;
  let x = cx + 14, y = cy - th / 2;
  if (x + tw > window.innerWidth  - 8) x = cx - tw - 14;
  if (y < 8)                            y = 8;
  if (y + th > window.innerHeight - 8)  y = window.innerHeight - th - 8;
  chartTooltip.style.left = x + 'px';
  chartTooltip.style.top  = y + 'px';
}
function hideTooltip() { chartTooltip?.classList.remove('visible'); }

if (statsCanvas) {
  statsCanvas.addEventListener('mousemove', e => {
    if (!chartHitData) return;
    const rect = statsCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (chartHitData.type === 'line') {
      let nearest = null, minDist = 20;
      for (const p of chartHitData.pts) {
        const d = Math.hypot(mx - p.x, my - p.y);
        if (d < minDist) { nearest = p; minDist = d; }
      }
      if (nearest) {
        showTooltip(
          `<span class="tt-label">${nearest.label}</span><strong>${nearest.value}</strong>`,
          e.clientX, e.clientY
        );
      } else {
        hideTooltip();
      }
    } else if (chartHitData.type === 'bar') {
      let hit = null;
      for (const r of chartHitData.regions) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          hit = r; break;
        }
      }
      if (hit) {
        showTooltip(
          `<span class="tt-dot" style="color:${hit.color}">●</span><span class="tt-label">${hit.label}</span><strong>${hit.count}</strong>`,
          e.clientX, e.clientY
        );
      } else {
        hideTooltip();
      }
    }
  });
  statsCanvas.addEventListener('mouseleave', hideTooltip);
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
    if (!map[e.domain]) map[e.domain] = { value: 0, cats: {} };
    map[e.domain].value++;
    const cat = e.category || 'unknown';
    map[e.domain].cats[cat] = (map[e.domain].cats[cat] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 15)
    .map(([label, d]) => ({ label, value: d.value, cats: d.cats }));
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

const LEGEND_ITEMS = [
  { label: 'Tracking',  color: '#c9806a', stroke: '#8b4d3f', cats: ['tracking', 'third-party', 'advertising'] },
  { label: 'Analytics', color: '#c4a84e', stroke: '#8b7030', cats: ['analytics'] },
  { label: 'Safe',      color: '#8aaa7a', stroke: '#4a7a5a', cats: ['session', 'authentication', 'functional'] },
  { label: 'Unknown',   color: '#a8876a', stroke: '#7a5c3f', cats: ['unknown'] },
];

function setupCanvas(canvas) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

// Catmull-Rom spline — draws bezier segments through pts (no moveTo, call after ctx.moveTo).
// maxY: optional floor clamp (canvas y grows downward) — prevents control points from
// overshooting below the x-axis when adjacent points have value = 0.
function drawSpline(ctx, pts, maxY) {
  const cy = maxY !== undefined ? (y) => Math.min(y, maxY) : (y) => y;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t  = 0.35;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * t / 2, cy(p1.y + (p2.y - p0.y) * t / 2),
      p2.x - (p3.x - p1.x) * t / 2, cy(p2.y - (p3.y - p1.y) * t / 2),
      p2.x, p2.y
    );
  }
}

// Deterministic sine-wobble line — matches the hand-drawn #hd filter aesthetic
function roughLine(ctx, x1, y1, x2, y2, amp) {
  if (amp === undefined) amp = 1.4;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx  = -dy / len, ny = dx / len;
  const segs = Math.max(4, Math.ceil(len / 10));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = Math.sin(t * Math.PI * 3.8) * amp;
    if (i === 0) ctx.moveTo(x1 + nx * w,          y1 + ny * w);
    else         ctx.lineTo(x1 + dx*t + nx * w,   y1 + dy*t + ny * w);
  }
}

function drawBarChart(canvas, data) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const isEmpty  = !data.length;
  const maxVal   = isEmpty ? 5 : Math.max(...data.map(d => d.value), 1);
  const padLeft  = isEmpty ? 40 : Math.min(160, w * 0.3);
  const padTop   = 12;
  const padBot   = 48;
  const rowCount = isEmpty ? 5 : data.length;
  const rowH     = (h - padTop - padBot) / rowCount;
  const barH     = Math.min(rowH * 0.52, 24);
  const axisY    = h - padBot + 4;
  const labelFs  = Math.min(11, w * 0.016);
  // Derive padRight from the actual rendered width of the largest value label
  const valFs    = Math.min(13, rowH * 0.45);
  ctx.font = `500 ${valFs}px Fredoka, sans-serif`;
  const padRight = isEmpty ? 20 : Math.ceil(ctx.measureText(String(maxVal)).width) + 10;
  const barArea  = w - padLeft - padRight;

  // Vertical grid lines + x-axis count labels
  ctx.font = `400 ${labelFs}px Fredoka, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  for (let s = 0; s <= 4; s++) {
    const gx = padLeft + (s / 4) * barArea;
    if (s > 0) {
      ctx.lineWidth   = 0.8;
      ctx.strokeStyle = C.grid;
      ctx.beginPath(); roughLine(ctx, gx, padTop, gx, axisY, 0.7); ctx.stroke();
    }
    if (!isEmpty) {
      ctx.fillStyle = C.text;
      ctx.fillText(Math.round((maxVal / 4) * s), gx, axisY + 5);
    }
  }

  // Axes
  const axisColor = isEmpty ? 'rgba(102,87,71,0.3)' : C.text;
  ctx.strokeStyle = axisColor;
  ctx.lineWidth   = 1.3;
  ctx.beginPath(); roughLine(ctx, padLeft, padTop, padLeft, axisY, 1.1); ctx.stroke();
  ctx.beginPath(); roughLine(ctx, padLeft, axisY, w - padRight + 4, axisY, 0.9); ctx.stroke();

  ctx.font = `500 ${Math.min(13, rowH * 0.45)}px Fredoka, sans-serif`;
  ctx.textBaseline = 'middle';

  const hitRegions = [];

  if (isEmpty) {
    const ghostWidths = [0.72, 0.54, 0.40, 0.26, 0.16];
    ghostWidths.forEach((frac, i) => {
      const y  = padTop + i * rowH + rowH / 2;
      const bw = barArea * frac;
      const r  = Math.min(barH / 2, 6);
      ctx.fillStyle = 'rgba(168,135,106,0.09)';
      roundRect(ctx, padLeft, y - barH / 2, bw, barH, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(168,135,106,0.22)';
      ctx.lineWidth   = 0.9;
      ctx.beginPath(); roughLine(ctx, padLeft, y - barH / 2, padLeft + bw, y - barH / 2, 0.6); ctx.stroke();
      ctx.beginPath(); roughLine(ctx, padLeft, y + barH / 2, padLeft + bw, y + barH / 2, 0.6); ctx.stroke();
    });
  } else {
    data.forEach((d, i) => {
      const y   = padTop + i * rowH + rowH / 2;
      const barW = (d.value / maxVal) * barArea;
      const r   = Math.min(barH / 2, 6);
      const bw  = Math.max(barW, r * 2);

      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label, padLeft - 8, y);

      const hasCats = d.cats && Object.keys(d.cats).length > 0;
      if (hasCats) {
        // Stacked segments using clip for rounded corners
        ctx.save();
        roundRect(ctx, padLeft, y - barH / 2, bw, barH, r);
        ctx.clip();
        let segX = padLeft;
        for (const item of LEGEND_ITEMS) {
          const count = item.cats.reduce((s, c) => s + (d.cats[c] || 0), 0);
          if (!count) continue;
          const segW = (count / maxVal) * barArea;
          ctx.fillStyle = item.color;
          ctx.fillRect(segX, y - barH / 2, segW + 1, barH);
          hitRegions.push({ x: segX, y: y - barH / 2, w: segW, h: barH, label: item.label, color: item.color, count });
          segX += segW;
        }
        ctx.restore();
      } else {
        const grad = ctx.createLinearGradient(padLeft, 0, padLeft + barW, 0);
        grad.addColorStop(0, C.fill);
        grad.addColorStop(1, C.fillAlt);
        ctx.fillStyle = grad;
        roundRect(ctx, padLeft, y - barH / 2, bw, barH, r);
        ctx.fill();
        hitRegions.push({ x: padLeft, y: y - barH / 2, w: bw, h: barH, label: d.label, color: C.fill, count: d.value });
      }

      ctx.strokeStyle = hasCats ? 'rgba(102,87,71,0.35)' : C.accent;
      ctx.lineWidth   = 0.9;
      ctx.beginPath(); roughLine(ctx, padLeft, y - barH / 2, padLeft + bw, y - barH / 2, 0.6); ctx.stroke();
      ctx.beginPath(); roughLine(ctx, padLeft, y + barH / 2, padLeft + bw, y + barH / 2, 0.6); ctx.stroke();

      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(d.value, padLeft + bw + 6, y);
    });

    // Legend
    ctx.font = `400 ${labelFs}px Fredoka, sans-serif`;
    ctx.textBaseline = 'middle';
    const legY     = h - 14;
    const legItemW = Math.min(88, (w - padLeft - 8) / LEGEND_ITEMS.length);
    LEGEND_ITEMS.forEach((item, i) => {
      const lx = padLeft + i * legItemW;
      ctx.fillStyle = item.color;
      roundRect(ctx, lx, legY - 5, 11, 10, 3);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + 15, legY);
    });
  }

  return { type: 'bar', regions: hitRegions };
}

function drawLineChart(canvas, data) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const isEmpty  = !data.length;
  const maxVal   = isEmpty ? 5 : Math.max(...data.map(d => d.value), 1);
  const padLeft  = 44;
  const padRight = 16;
  const padTop   = 16;
  const padBot   = 40;
  const chartW   = w - padLeft - padRight;
  const chartH   = h - padTop - padBot;
  const labelFs  = Math.min(11, w * 0.016);

  // Horizontal grid lines + Y-axis labels
  const ySteps = 4;
  ctx.font = `400 ${labelFs}px Fredoka, sans-serif`;
  ctx.textAlign    = 'right';
  for (let s = 0; s <= ySteps; s++) {
    const val = isEmpty ? s : Math.round((maxVal / ySteps) * s);
    const y   = padTop + chartH - (s / ySteps) * chartH;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); roughLine(ctx, padLeft, y, padLeft + chartW, y, 0.7); ctx.stroke();
    // avoid cramping the 0 label against the axis
    ctx.textBaseline = s === 0 ? 'bottom' : 'middle';
    ctx.fillStyle    = isEmpty ? 'rgba(102,87,71,0.3)' : C.text;
    ctx.fillText(val, padLeft - 5, s === 0 ? y - 1 : y);
  }

  // Axes
  const axisColor = isEmpty ? 'rgba(102,87,71,0.3)' : C.text;
  ctx.strokeStyle = axisColor;
  ctx.lineWidth   = 1.3;
  ctx.beginPath(); roughLine(ctx, padLeft, padTop, padLeft, padTop + chartH, 1.1); ctx.stroke();
  ctx.beginPath(); roughLine(ctx, padLeft, padTop + chartH, padLeft + chartW, padTop + chartH, 0.9); ctx.stroke();

  if (isEmpty) return;

  const pts = data.map((d, i) => ({
    x: padLeft + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padTop + chartH - (d.value / maxVal) * chartH,
    value: d.value,
    label: d.label,
  }));

  // Area fill with bezier spline
  const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  areaGrad.addColorStop(0, 'rgba(168,135,106,0.28)');
  areaGrad.addColorStop(1, 'rgba(168,135,106,0.02)');
  ctx.fillStyle = areaGrad;
  const axisY = padTop + chartH;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, axisY);
  ctx.lineTo(pts[0].x, pts[0].y);
  drawSpline(ctx, pts, axisY);
  ctx.lineTo(pts[pts.length - 1].x, axisY);
  ctx.closePath();
  ctx.fill();

  // Line with bezier spline
  ctx.strokeStyle = C.fill;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  drawSpline(ctx, pts, axisY);
  ctx.stroke();

  // Dots
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle   = '#f4d6be';
    ctx.strokeStyle = C.fill;
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
  });

  // X-axis labels
  ctx.font = `400 ${labelFs}px Fredoka, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  ctx.fillStyle    = C.text;
  const labelEvery = Math.max(1, Math.ceil(pts.length / 10));
  pts.forEach((p, i) => {
    if (data[i].label && i % labelEvery === 0) {
      ctx.fillText(data[i].label, p.x, padTop + chartH + 6);
    }
  });

  return { type: 'line', pts };
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
  { pattern: 'IDE',    label: 'Google DoubleClick',       why: 'Records and measures clicks on display ads across Google\'s ad network' },
  { pattern: '_tt_*',  label: 'TikTok Tracking',          why: 'TikTok\'s event cookie that measures ad conversion from campaigns' },
  { pattern: 'MUID',   label: 'Microsoft Advertising',    why: 'Cross-site user ID for ad targeting on Bing, MSN, and partner sites' },
];

const CAT_LABELS = {
  session: 'Session', authentication: 'Auth', tracking: 'Tracking',
  'third-party': '3rd Party', analytics: 'Analytics', advertising: 'Ads',
  functional: 'Functional', unknown: 'Unknown',
};

btnCustomize?.addEventListener('click', () => {
  if (customizeVisible) { showHome(); return; }
  showPanel('customize');
});

async function loadCustomRules() {
  try {
    const data = await chrome.storage.sync.get('customRules');
    customRules = data.customRules || { domains: [], maxAgeDays: null, blockedPatterns: [] };
  } catch (e) { /* unavailable outside extension context */ }
  updateCustRuleCount();
}

async function saveCustomRules() {
  try {
    await chrome.storage.sync.set({ customRules });
  } catch (e) { /* unavailable outside extension context */ }
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

// ── Contact form ───────────────────────────────────────
let recaptchaPassed = false;

document.getElementById('recaptchaCheck')?.addEventListener('click', function () {
  recaptchaPassed = !recaptchaPassed;
  this.classList.toggle('checked', recaptchaPassed);
  this.setAttribute('aria-checked', String(recaptchaPassed));
});

document.getElementById('contactForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form    = document.getElementById('contactForm');
  const name    = document.getElementById('cfName')?.value.trim();
  const email   = document.getElementById('cfEmail')?.value.trim();
  const subject = document.getElementById('cfSubject')?.value.trim();
  const message = document.getElementById('cfMessage')?.value.trim();
  const success = document.getElementById('contactSuccess');
  const submit  = document.getElementById('contactSubmit');
  if (!name || !email || !subject || !message || !recaptchaPassed) return;

  submit.disabled = true;

  try {
    const res = await fetch('https://formspree.io/f/maqklpga', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form),
    });

    if (res.ok) {
      if (success) success.classList.remove('fp-hidden');
      form.reset();
      recaptchaPassed = false;
      document.getElementById('recaptchaCheck')?.classList.remove('checked');
      setTimeout(() => {
        if (success) success.classList.add('fp-hidden');
        submit.disabled = false;
      }, 5000);
    } else {
      submit.disabled = false;
      if (success) {
        success.textContent = 'Something went wrong. Please try again.';
        success.classList.remove('fp-hidden');
        setTimeout(() => {
          success.textContent = 'Thanks! Your message has been sent. We\'ll be in touch soon.';
          success.classList.add('fp-hidden');
        }, 4000);
      }
    }
  } catch {
    submit.disabled = false;
  }
});

// ── Render orchestrator ────────────────────────────────
async function renderStats() {
  if (!statsCanvas) return;

  const statsLoading = document.getElementById('statsLoading');
  statsCanvas.style.display = 'none';
  statsEmpty.style.display  = 'none';
  if (statsLoading) statsLoading.classList.add('visible');

  let log = [];
  try {
    const data = await chrome.storage.local.get('blockedLog');
    log = data.blockedLog || [];
  } catch (e) { /* chrome.storage unavailable outside extension context */ }

  if (statsLoading) statsLoading.classList.remove('visible');

  const filtered = getFilteredLog(log, activePeriod);
  statsCount.textContent = `${filtered.length} cookie${filtered.length === 1 ? '' : 's'} blocked`;

  const isEmpty = filtered.length === 0;
  statsEmpty.style.display  = isEmpty ? '' : 'none';
  statsCanvas.style.display = '';

  requestAnimationFrame(() => {
    if (activeType === 'bar') {
      chartHitData = drawBarChart(statsCanvas, isEmpty ? [] : aggregateByDomain(filtered));
    } else if (activeType === 'line') {
      chartHitData = drawLineChart(statsCanvas, isEmpty ? [] : aggregateByTime(filtered, activePeriod));
    } else {
      chartHitData = drawDonutChart(statsCanvas, isEmpty ? [] : aggregateByCategory(filtered));
    }
  });
}

// ── Donut chart ────────────────────────────────────────
const DONUT_COLORS = {
  tracking:       { fill: '#c9806a', stroke: '#8b4d3f' },
  'third-party':  { fill: '#c9806a', stroke: '#8b4d3f' },
  advertising:    { fill: '#c9806a', stroke: '#8b4d3f' },
  analytics:      { fill: '#c4a84e', stroke: '#8b7030' },
  session:        { fill: '#8aaa7a', stroke: '#4a7a5a' },
  authentication: { fill: '#8aaa7a', stroke: '#4a7a5a' },
  functional:     { fill: '#8aaa7a', stroke: '#4a7a5a' },
  unknown:        { fill: '#a8876a', stroke: '#7a5c3f' },
};

function aggregateByCategory(entries) {
  const map = {};
  for (const e of entries) {
    const cat = e.category || 'unknown';
    map[cat] = (map[cat] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function drawDonutChart(canvas, data) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!data.length) return { type: 'donut', slices: [] };

  const total   = data.reduce((s, d) => s + d.value, 0);
  const cx      = w * 0.4;
  const cy      = h / 2;
  const outerR  = Math.min(cx * 0.82, cy * 0.82);
  const innerR  = outerR * 0.56;
  const labelFs = Math.min(11, w * 0.016);
  let startAngle = -Math.PI / 2;
  const slices = [];

  for (const item of data) {
    const color    = DONUT_COLORS[item.label] || { fill: '#a8876a', stroke: '#7a5c3f' };
    const angle    = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle   = color.fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    slices.push({ startAngle, endAngle, label: item.label, value: item.value, color: color.fill, cx, cy, innerR, outerR });
    startAngle = endAngle;
  }

  // Center label
  function fmtNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = C.text;
  ctx.font = `700 ${Math.min(38, h * 0.19)}px Fredoka, sans-serif`;
  ctx.fillText(fmtNum(total), cx, cy - Math.min(12, h * 0.06));
  ctx.font = `400 ${Math.min(15, h * 0.075)}px Fredoka, sans-serif`;
  ctx.fillStyle = 'rgba(102,87,71,0.6)';
  ctx.fillText('blocked', cx, cy + Math.min(16, h * 0.08));

  // Legend
  const legX      = cx + outerR + 18;
  const legItemH  = Math.min(20, (h - 16) / data.length);
  const legStartY = (h - data.length * legItemH) / 2;

  ctx.font      = `400 ${labelFs}px Fredoka, sans-serif`;
  ctx.textAlign = 'left';
  data.forEach((item, i) => {
    const color = DONUT_COLORS[item.label] || { fill: '#a8876a' };
    const ly    = legStartY + i * legItemH + legItemH / 2;
    const pct   = Math.round((item.value / total) * 100);
    ctx.fillStyle = color.fill;
    roundRect(ctx, legX, ly - 5, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle    = C.text;
    ctx.textBaseline = 'middle';
    const cap = item.label.charAt(0).toUpperCase() + item.label.slice(1);
    ctx.fillText(`${cap} — ${pct}%`, legX + 15, ly);
  });

  return { type: 'donut', slices };
}

// ── Export stats CSV ───────────────────────────────────
document.getElementById('statsExportBtn')?.addEventListener('click', async () => {
  let log = [];
  try {
    const data = await chrome.storage.local.get('blockedLog');
    log = data.blockedLog || [];
  } catch (e) {}
  const filtered = getFilteredLog(log, activePeriod);
  if (!filtered.length) return;
  const rows = [['Date', 'Time', 'Domain', 'Category']];
  for (const e of filtered) {
    const d = new Date(e.ts);
    rows.push([d.toLocaleDateString(), d.toLocaleTimeString(), e.domain, e.category]);
  }
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `cookie-jar-${activePeriod}-${new Date().toISOString().slice(0,10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
});

// ── Export / Import settings ───────────────────────────
document.getElementById('fpExportSettings')?.addEventListener('click', async () => {
  try {
    const data = await chrome.storage.sync.get(['preferences', 'customRules']);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `cookie-jar-settings-${new Date().toISOString().slice(0,10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {}
});

document.getElementById('fpImportSettings')?.addEventListener('click', () => {
  document.getElementById('fpImportFile')?.click();
});

document.getElementById('fpImportFile')?.addEventListener('change', async function () {
  const file = this.files?.[0];
  if (!file) return;
  const btn = document.getElementById('fpImportSettings');
  try {
    const data = JSON.parse(await file.text());
    if (data.preferences) await chrome.storage.sync.set({ preferences: CookiePrefs.mergePrefs(data.preferences) });
    if (data.customRules)  await chrome.storage.sync.set({ customRules: data.customRules });
    await loadAndSync();
    await loadCustomRules();
    if (btn) { btn.textContent = '✓ Imported'; setTimeout(() => btn.textContent = '↑ Import Settings', 2000); }
  } catch (e) {
    if (btn) { btn.textContent = '✗ Invalid file'; setTimeout(() => btn.textContent = '↑ Import Settings', 2000); }
  }
  this.value = '';
});

// ── Donut tooltip hit-test ─────────────────────────────
const _origMouseMove = statsCanvas?.onmousemove;
if (statsCanvas) {
  statsCanvas.addEventListener('mousemove', e => {
    if (!chartHitData || chartHitData.type !== 'donut') return;
    const rect  = statsCanvas.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const slice = chartHitData.slices.find(s => {
      const d = Math.hypot(mx - s.cx, my - s.cy);
      if (d < s.innerR || d > s.outerR) return false;
      let a = Math.atan2(my - s.cy, mx - s.cx);
      const norm = ang => ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return norm(a) >= norm(s.startAngle) && norm(a) <= norm(s.endAngle);
    });
    if (slice) {
      showTooltip(`<span class="tt-dot" style="color:${slice.color}">●</span><span class="tt-label">${slice.label}</span><strong>${slice.value}</strong>`, e.clientX, e.clientY);
    } else {
      hideTooltip();
    }
  });
}
