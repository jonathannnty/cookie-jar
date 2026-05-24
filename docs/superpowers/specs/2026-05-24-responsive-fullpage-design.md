# Responsive Fullpage — Tab Navigation Design Spec
_Date: 2026-05-24_

## Goal
Make `fullpage/fullpage.html` work on mobile and tablet screens (≤900px wide) by switching the two-column layout to a single-panel tab navigation view.

---

## Breakpoints

| Width | Layout |
|---|---|
| >900px | Existing two-column desktop layout — unchanged |
| ≤900px | Tab layout: topbar + tab bar + one panel at a time |
| ≤480px | Additional condensing: smaller topbar title, glass wider |

---

## Tab Bar

**HTML** — insert `<nav class="tab-bar" id="tabBar">` between `.topbar` and `.main`:
```html
<nav class="tab-bar" id="tabBar">
  <button class="tab-btn active" data-tab="jar">Cookie Jar</button>
  <button class="tab-btn" data-tab="glass">Milk Glass</button>
</nav>
```

**Active state:** `.tab-btn.active` shows an underline indicator in `#8B5A2B`.

**Desktop:** `display: none` — tab bar is invisible above 900px.

**Initial active tab:** `.main` has `data-active-tab="jar"` in HTML. Cookie Jar tab is shown first.

---

## Panel Visibility (CSS)

Active tab controls which panel is shown:
```css
@media (max-width: 900px) {
  .main[data-active-tab="jar"] .glass-panel { display: none; }
  .main[data-active-tab="glass"] .jar-panel  { display: none; }
}
```

---

## CSS Changes at ≤900px

### html, body
- Remove `overflow: hidden`
- Add `overflow-x: hidden; overflow-y: auto`
- Remove `height: 100%` — let height be driven by content

### .topbar
- `padding: 8px 16px`

### .topbar-logo
- `height: 32px`

### .topbar-title
- `font-size: 22px`

### .tab-bar (new rule)
- `display: flex`
- `flex-shrink: 0`
- `border-bottom: 2px solid rgba(196,168,112,0.35)`
- `padding: 0 16px`
- `background: transparent`

### .tab-btn (new rule)
- `flex: 1`
- `padding: 10px 8px`
- `background: transparent`
- `border: none`
- `border-bottom: 3px solid transparent`
- `margin-bottom: -2px`
- `font-family: 'Fredoka', 'Trebuchet MS', sans-serif`
- `font-size: 16px`
- `font-weight: 600`
- `color: #8e6f48`
- `cursor: pointer`
- `transition: color 0.15s, border-color 0.15s`

### .tab-btn.active (new rule)
- `color: #5b4a38`
- `border-bottom-color: #8B5A2B`

### .main
- `flex-direction: column`
- `padding: 8px 16px 24px`
- `gap: 16px`
- `overflow: visible`

### .jar-panel
- `flex: none`
- `width: 100%`
- `min-height: 70vh`
- `height: auto`

### .jar-body
- `padding: 10% 12px 6%`

### .jar-scroll
- `overflow-y: visible` — page scrolls, not inner element

### .glass-panel
- `flex: none`
- `width: 100%`
- `height: auto`
- `align-items: center`

### .glass-outer
- `height: auto`
- `width: 80%`
- `max-width: 380px`
- `margin: 0 auto`
- Keep `aspect-ratio: 450 / 672`

---

## CSS Changes at ≤480px

### .topbar-title
- `font-size: 18px`

### .glass-outer
- `width: 95%`

### .jar-panel
- `min-height: 80vh`

---

## JS Changes (`fullpage.js`)

Add tab switching logic after the existing button event listeners:

```javascript
const tabBar = document.getElementById('tabBar');
if (tabBar) {
  const main = document.querySelector('.main');
  tabBar.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    main.dataset.activeTab = btn.dataset.tab;
  });
}
```

---

## Unchanged

- Desktop (>900px) layout: no changes
- All existing animations, SVG assets, milk level logic
- Popup widget (popup.html/css/js): untouched
- Tab bar `display: none` on desktop — zero impact on existing layout

---

## Self-Review

- No placeholders or TBDs
- Breakpoints are unambiguous (900px, 480px)
- Desktop layout explicitly unchanged — media queries are additive
- `data-active-tab` attribute name used consistently across HTML, CSS, and JS
- `.jar-scroll { overflow-y: visible }` on mobile is intentional — page scroll replaces inner scroll
- `.glass-outer` uses `height: auto` + `aspect-ratio` on mobile so the glass scales by width rather than height
