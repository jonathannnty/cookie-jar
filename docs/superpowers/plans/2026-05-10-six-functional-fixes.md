# Cookie Jar – Six Functional Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six functional bugs in the Cookie Jar Chrome extension: duplicate classification patterns, four-way fragmented preferences defaults, popup/options mode mismatch, incomplete fullpage category coverage, missed post-load cookies, and silent cookie removal failures.

**Architecture:** Task 1 (classifier) is fully standalone. Task 2 (shared prefs) introduces `utils/prefs.js`; Tasks 3 and 4 depend on it. Tasks 5 and 6 only touch `background.js` and are independent of all others. Suggested order: 1 → 2 → 3 → 4 → 5 → 6, but 1, 5, 6 can land in any order without blocking each other.

**Tech Stack:** Vanilla JS, MV3 Chrome Extension APIs (`chrome.cookies`, `chrome.storage.local`, `chrome.tabs`), Node.js (classifier unit test only — no install required).

---

### Task 1: Fix duplicate tracking/analytics classification patterns

**Files:**
- Modify: `utils/cookie-classifier.js` (lines 107–133)

`PATTERNS.tracking` and `PATTERNS.analytics` share 10 cookie name patterns (`_ga`, `_gid`, `_gat`, `__utm*`, `_hjid`, `_hjSession`, `amplitude_id`, `mp_`, `__qca`, `_dc_gtm_`). Since `classifyCookie` checks `tracking` before `analytics` (lines 163–165), analytics cookies like Google Analytics and Hotjar are permanently mislabelled as tracking. Fix: remove the duplicates from `PATTERNS.tracking`.

- [ ] **Step 1: Verify the bug with a quick Node.js test**

Create `test-classifier.js` in the project root:

```javascript
// temp — delete after step 3
eval(require('fs').readFileSync('./utils/cookie-classifier.js', 'utf8'));

const cases = [
  { name: '_ga_ABC123',       expected: 'analytics' },
  { name: '_gid',             expected: 'analytics' },
  { name: '_gat_UA-123',      expected: 'analytics' },
  { name: '__utma',           expected: 'analytics' },
  { name: '_hjid',            expected: 'analytics' },
  { name: '_hjSessionUser_1', expected: 'analytics' },
  { name: 'amplitude_id_abc', expected: 'analytics' },
  { name: 'mp_abc_mixpanel',  expected: 'analytics' },
  { name: '__qca',            expected: 'analytics' },
  { name: '_dc_gtm_UA-123',   expected: 'analytics' },
  { name: '_fbp',             expected: 'tracking'  },
  { name: '_uetsid',          expected: 'tracking'  },
  { name: 'fr',               expected: 'tracking'  },
];

let pass = 0, fail = 0;
cases.forEach(({ name, expected }) => {
  const got = CookieClassifier.classifyCookie({ name, domain: '', secure: false }, 'example.com').category;
  if (got === expected) { console.log(`PASS  ${name} → ${got}`); pass++; }
  else { console.log(`FAIL  ${name} → got "${got}", expected "${expected}"`); fail++; }
});
console.log(`\n${pass} passed, ${fail} failed`);
```

Run: `node test-classifier.js`
Expected: the first 10 cases will FAIL (returning `"tracking"` instead of `"analytics"`).

- [ ] **Step 2: Replace `PATTERNS.tracking` — remove the analytics duplicates**

In `utils/cookie-classifier.js`, replace the `tracking` array (lines 112–127):

```javascript
    tracking: [
      /^_fbp$/, /^_fbc$/, /^fr$/, /^datr$/, /^sb$/, /^c_user$/, /^xs$/, /^wd$/,
      /^MUID$/, /^MUIDB$/, /^WT_FPC$/, /^MC1$/,
      /^_clck$/, /^_clsk$/,
      /^_tt_enable_cookie$/,
      /^ajs_/,
      /^intercom[-_]/, /^_intercom/,
      /^_mkto_trk$/, /^hubspotutk$/, /^__hstc$/, /^__hssc$/, /^__hssrc$/,
      /^ki_[ru]$/,
      /^_uetsid$/, /^_uetvid$/, /^_uetmsclkid$/,
      /^_pin_unauth$/, /^_pinterest_sess$/,
    ],
```

Also add `_gac_` to `PATTERNS.advertising` (it's a Google Ads conversion cookie, currently in tracking only):

```javascript
    advertising: [
      /^IDE$/, /^DSID$/, /^test_cookie$/, /^__gads$/, /^__gpi$/,
      /^_ttp$/, /^ttcsid$/, /^_rdt_uuid$/, /^_rdt_cid$/,
      /^_gcl_aw$/, /^_gcl_dc$/, /^_gcl_gb$/, /^_gac_/,
    ],
```

- [ ] **Step 3: Run the test again — all 13 cases should pass**

Run: `node test-classifier.js`

Expected output:
```
PASS  _ga_ABC123 → analytics
PASS  _gid → analytics
PASS  _gat_UA-123 → analytics
PASS  __utma → analytics
PASS  _hjid → analytics
PASS  _hjSessionUser_1 → analytics
PASS  amplitude_id_abc → analytics
PASS  mp_abc_mixpanel → analytics
PASS  __qca → analytics
PASS  _dc_gtm_UA-123 → analytics
PASS  _fbp → tracking
PASS  _uetsid → tracking
PASS  fr → tracking

13 passed, 0 failed
```

- [ ] **Step 4: Delete the temp test file**

```
del test-classifier.js
```

- [ ] **Step 5: Commit**

```
git add utils/cookie-classifier.js
git commit -m "fix: deduplicate tracking/analytics patterns so GA, Hotjar, Amplitude classify as analytics"
```

---

### Task 2: Extract shared preferences defaults into `utils/prefs.js`

**Files:**
- Create: `utils/prefs.js`
- Modify: `background.js` (lines 1–32)
- Modify: `popup/popup.html` (line 224)
- Modify: `popup/popup.js` (lines 63–72)
- Modify: `options/options.html` (line 291)
- Modify: `options/options.js` (lines 1–13, 36–49, 124–130)
- Modify: `onboarding/onboarding.html` (line 463)
- Modify: `onboarding/onboarding.js` (lines 66–95)

`DEFAULT_PREFS` is copy-pasted in four files (`background.js`, `popup/popup.js`, `options/options.js`, `onboarding/onboarding.js`). They have already drifted. Extract into a shared IIFE module using the same pattern as `cookie-classifier.js` — no ES module syntax, compatible with `importScripts` and `<script src>`.

- [ ] **Step 1: Create `utils/prefs.js`**

```javascript
'use strict';

const CookiePrefs = (() => {
  const DEFAULT_PREFS = {
    mode: 'simple',
    onboardingComplete: false,
    autoApply: true,
    categories: {
      necessary:      true,
      session:        true,
      authentication: true,
      tracking:       false,
      advertising:    false,
      analytics:      false,
      functional:     true,
      'third-party':  false,
      unknown:        false,
    },
    simple: {
      necessary: true,
      optional:  false,
    },
  };

  function mergePrefs(saved) {
    return Object.assign({}, DEFAULT_PREFS, saved, {
      categories: Object.assign({}, DEFAULT_PREFS.categories, saved?.categories),
      simple:     Object.assign({}, DEFAULT_PREFS.simple,     saved?.simple),
    });
  }

  return { DEFAULT_PREFS, mergePrefs };
})();
```

- [ ] **Step 2: Update `background.js` — remove inline DEFAULT_PREFS, use CookiePrefs**

Replace lines 1–32 of `background.js` with:

```javascript
'use strict';

importScripts('./utils/cookie-classifier.js');
importScripts('./utils/prefs.js');

async function getPrefs() {
  const data = await chrome.storage.local.get('preferences');
  return CookiePrefs.mergePrefs(data.preferences);
}
```

And in the `onInstalled` handler (previously line 78), replace `DEFAULT_PREFS` with `CookiePrefs.DEFAULT_PREFS`:

```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ preferences: CookiePrefs.DEFAULT_PREFS });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});
```

- [ ] **Step 3: Add `utils/prefs.js` script tag to `popup/popup.html`**

In `popup/popup.html`, line 224, the script tags currently read:
```html
<script src="../utils/cookie-classifier.js"></script>
<script src="popup.js"></script>
```

Replace with:
```html
<script src="../utils/cookie-classifier.js"></script>
<script src="../utils/prefs.js"></script>
<script src="popup.js"></script>
```

- [ ] **Step 4: Update `popup/popup.js` — use CookiePrefs.mergePrefs**

Replace the `loadPrefs` function (lines 63–72):

```javascript
async function loadPrefs() {
  const data = await chrome.storage.local.get('preferences');
  currentPrefs = CookiePrefs.mergePrefs(data.preferences);
}
```

- [ ] **Step 5: Add `utils/prefs.js` script tag to `options/options.html`**

In `options/options.html`, lines 290–291 currently read:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script src="options.js"></script>
```

Replace with:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script src="../utils/prefs.js"></script>
  <script src="options.js"></script>
```

- [ ] **Step 6: Update `options/options.js` — use CookiePrefs**

Replace line 27 (the `currentPrefs` declaration):
```javascript
let currentPrefs = { ...CookiePrefs.DEFAULT_PREFS };
```

Replace the `load` function (lines 36–49):
```javascript
async function load() {
  const data = await chrome.storage.local.get('preferences');
  currentPrefs = CookiePrefs.mergePrefs(data.preferences);
  currentPrefs.onboardingComplete = true;

  document.getElementById('autoApply').checked = currentPrefs.autoApply !== false;
  document.getElementById('simpleOptional').checked = currentPrefs.simple.optional ?? false;

  setMode(currentPrefs.mode || 'simple', false);
  buildAdvancedRows();
  applySavedToAdvanced();
}
```

Replace the `btnReset` handler (lines 124–130):
```javascript
document.getElementById('btnReset').addEventListener('click', async () => {
  if (!confirm('Reset all preferences to defaults?')) return;
  currentPrefs = { ...CookiePrefs.DEFAULT_PREFS, onboardingComplete: true };
  await chrome.storage.local.set({ preferences: currentPrefs });
  load();
  setStatus('Reset to defaults ✓', 2500);
});
```

Also remove the now-redundant `DEFAULT_PREFS` and `ADVANCED_DEFS` constant at the top of the file — `ADVANCED_DEFS` is still needed for `buildAdvancedRows`, but `DEFAULT_PREFS` (lines 3–13) should be deleted.

- [ ] **Step 7: Add `utils/prefs.js` script tag to `onboarding/onboarding.html`**

In `onboarding/onboarding.html`, lines 463–464 currently read:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script src="onboarding.js"></script>
```

Replace with:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script src="../utils/prefs.js"></script>
  <script src="onboarding.js"></script>
```

- [ ] **Step 8: Update `onboarding/onboarding.js` — use CookiePrefs in save handler**

Replace the `saveBtn` click handler (lines 66–96):

```javascript
document.getElementById('saveBtn').addEventListener('click', async () => {
  const categories = { ...CookiePrefs.DEFAULT_PREFS.categories };

  if (currentMode === 'advanced') {
    document.querySelectorAll('[data-cat]').forEach(input => {
      categories[input.dataset.cat] = input.checked;
    });
  }

  const prefs = {
    ...CookiePrefs.DEFAULT_PREFS,
    mode: currentMode,
    onboardingComplete: true,
    categories,
    simple: {
      necessary: true,
      optional: document.getElementById('simpleOptional')?.checked ?? false,
    },
  };

  await chrome.storage.local.set({ preferences: prefs });
  window.close();
});
```

- [ ] **Step 9: Verify in Chrome**

1. Open `chrome://extensions`, enable Developer mode, click "Load unpacked", select the project root.
2. Click the Cookie Jar icon — popup opens with correct default states.
3. Right-click the extension icon → Options — settings page loads, toggles match defaults.
4. Toggle a category, click "Save preferences", close and reopen options — state persists.
5. Click "Reset to defaults" — all toggles return to defaults.
6. In the Extensions page, click the "Inspect views: service worker" link — no console errors on load.

- [ ] **Step 10: Commit**

```
git add utils/prefs.js background.js popup/popup.html popup/popup.js options/options.html options/options.js onboarding/onboarding.html onboarding/onboarding.js
git commit -m "refactor: extract DEFAULT_PREFS into utils/prefs.js, eliminating four diverging copies"
```

---

### Task 3: Sync popup toggles with simple/advanced mode

**Files:**
- Modify: `popup/popup.js` (lines 74–128)

The popup always behaves as if mode is `advanced`, regardless of what the user set in Options. In `background.js`, enforcement already branches on `prefs.mode`, so the popup writing to the wrong key means the enforcement has no effect when mode is `simple`. Fix: in simple mode, optional toggles (tracking, third-party) both reflect and write `prefs.simple.optional`; necessary toggles (session, auth) are always checked.

- [ ] **Step 1: Replace `syncMainToggles` in `popup/popup.js`**

Replace the existing `syncMainToggles` function (lines 74–87):

```javascript
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
```

- [ ] **Step 2: Replace the toggle change handlers in `popup/popup.js`**

Replace the event listener block (lines 119–129):

```javascript
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
```

- [ ] **Step 3: Verify in Chrome**

1. Open Options, select **Simple** mode, ensure "Optional Cookies" is **off**, click Save.
2. Open the popup — the Tracking and Third-Party toggles should both be **off**.
3. Toggle "Tracking Cookies" on in the popup — "Third-Party Cookies" should flip on too.
4. Navigate to a site with tracking cookies (e.g., a news site). In DevTools → Application → Cookies, tracking cookies should be absent.
5. Back in Options, switch to **Advanced** mode, save.
6. Open popup — each toggle should reflect its individual `categories` value independently.

- [ ] **Step 4: Commit**

```
git add popup/popup.js
git commit -m "fix: popup toggles now respect simple/advanced mode — optional cookies route to prefs.simple.optional in simple mode"
```

---

### Task 4: Add missing cookie categories to fullpage view

**Files:**
- Modify: `fullpage/fullpage.html` (left panel, script block)

The full page only shows session, authentication, and tracking. Saving from this page reads only those three toggles — silently dropping the other six categories from storage. Add sections for third-party, analytics, advertising, functional, and unknown; fix the save handler to read full stored prefs before writing.

- [ ] **Step 1: Add `utils/prefs.js` script tag to `fullpage/fullpage.html`**

Near the bottom of `fullpage/fullpage.html`, the script tags currently read:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script>
```

Replace with:
```html
  <script src="../utils/cookie-classifier.js"></script>
  <script src="../utils/prefs.js"></script>
  <script>
```

- [ ] **Step 2: Add five missing cookie sections to the left panel**

In `fullpage/fullpage.html`, after the closing `</div>` of the "Tracking Cookies" section (and before the save button), insert:

```html
      <!-- Third-Party Cookies -->
      <div class="cookie-section">
        <div class="cookie-section-header">
          <label class="cookie-section-toggle" data-flavor="redvelvet">
            <input type="checkbox" data-cat="third-party">
            <div class="cs-track">
              <div class="cs-thumb"><img src="../icons/cookie-redvelvet.svg" alt=""></div>
            </div>
          </label>
          <span class="cookie-section-name">Third-Party Cookies</span>
        </div>
        <p class="cookie-section-body">
          Third-party cookies are set by a domain different from the site you're on — embedded social buttons, videos, or ad networks. They can track your browsing across many sites simultaneously.
        </p>
      </div>

      <!-- Analytics Cookies -->
      <div class="cookie-section">
        <div class="cookie-section-header">
          <label class="cookie-section-toggle" data-flavor="matcha">
            <input type="checkbox" data-cat="analytics">
            <div class="cs-track">
              <div class="cs-thumb"><img src="../icons/cookie-matcha.svg" alt=""></div>
            </div>
          </label>
          <span class="cookie-section-name">Analytics Cookies</span>
        </div>
        <p class="cookie-section-body">
          Analytics cookies measure how visitors use a website — which pages are popular, where people drop off, and how long they spend. Less intrusive than tracking, though aggregate data can still identify individuals.
        </p>
      </div>

      <!-- Advertising Cookies -->
      <div class="cookie-section">
        <div class="cookie-section-header">
          <label class="cookie-section-toggle" data-flavor="redvelvet">
            <input type="checkbox" data-cat="advertising">
            <div class="cs-track">
              <div class="cs-thumb"><img src="../icons/cookie-redvelvet.svg" alt=""></div>
            </div>
          </label>
          <span class="cookie-section-name">Advertising Cookies</span>
        </div>
        <p class="cookie-section-body">
          Advertising cookies deliver targeted ads based on your browsing history and measure ad conversions. They are often shared across hundreds of advertising networks.
        </p>
      </div>

      <!-- Functional Cookies -->
      <div class="cookie-section">
        <div class="cookie-section-header">
          <label class="cookie-section-toggle" data-flavor="matcha">
            <input type="checkbox" data-cat="functional" checked>
            <div class="cs-track">
              <div class="cs-thumb"><img src="../icons/cookie-matcha.svg" alt=""></div>
            </div>
          </label>
          <span class="cookie-section-name">Functional Cookies</span>
        </div>
        <p class="cookie-section-body">
          Functional cookies save your preferences — like language, theme, or font size — so you don't reset them every visit. Generally low-risk, though they can persist as a long-lived fingerprint.
        </p>
      </div>

      <!-- Unknown Cookies -->
      <div class="cookie-section">
        <div class="cookie-section-header">
          <label class="cookie-section-toggle" data-flavor="choc">
            <input type="checkbox" data-cat="unknown">
            <div class="cs-track">
              <div class="cs-thumb"><img src="../icons/cookie-choc.svg" alt=""></div>
            </div>
          </label>
          <span class="cookie-section-name">Unknown Cookies</span>
        </div>
        <p class="cookie-section-body">
          These cookies don't match any known pattern — could be custom app cookies, proprietary tracking, or site-specific data. When uncertain, consider blocking them from sites you don't fully trust.
        </p>
      </div>
```

- [ ] **Step 3: Fix the save handler and change listeners**

Inside the existing `<script>` block in `fullpage/fullpage.html`, replace the entire script content:

```javascript
    'use strict';

    async function loadAndSync() {
      const data = await chrome.storage.local.get('preferences');
      const prefs = CookiePrefs.mergePrefs(data.preferences);
      document.querySelectorAll('[data-cat]').forEach(input => {
        const cat = input.dataset.cat;
        if (prefs.categories[cat] !== undefined) input.checked = prefs.categories[cat];
      });
    }

    document.querySelectorAll('[data-cat]').forEach(input => {
      input.addEventListener('change', async () => {
        const data = await chrome.storage.local.get('preferences');
        const prefs = CookiePrefs.mergePrefs(data.preferences);
        prefs.categories[input.dataset.cat] = input.checked;
        await chrome.storage.local.set({ preferences: prefs });
      });
    });

    document.getElementById('saveFullPage')?.addEventListener('click', async () => {
      const data = await chrome.storage.local.get('preferences');
      const prefs = CookiePrefs.mergePrefs(data.preferences);
      document.querySelectorAll('[data-cat]').forEach(input => {
        prefs.categories[input.dataset.cat] = input.checked;
      });
      await chrome.storage.local.set({ preferences: prefs });

      const btn = document.getElementById('saveFullPage');
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save preferences'; }, 2000);
    });

    loadAndSync();
```

- [ ] **Step 4: Verify in Chrome**

1. Open Cookie Jar popup, click the expand icon (top-right) to open the full page.
2. All 8 cookie-type sections should be visible (session, authentication, tracking, third-party, analytics, advertising, functional, unknown).
3. Toggle "Advertising" off, click "Save preferences".
4. Open Options → Advanced — the Advertising toggle should be off.
5. Toggle it back on in Options, save, return to full page — Advertising should now be on.

- [ ] **Step 5: Commit**

```
git add fullpage/fullpage.html
git commit -m "fix: fullpage now shows all 8 cookie categories and saves without clobbering unlisted prefs"
```

---

### Task 5: Enforce cookie preferences in real-time via `chrome.cookies.onChanged`

**Files:**
- Modify: `background.js` (after the `tabs.onUpdated` listener)

The current `tabs.onUpdated` listener only fires on full navigation (`status === 'complete'`). Cookies set via XHR/fetch `Set-Cookie` response headers after page load are missed until the next navigation. `chrome.cookies.onChanged` fires for all cookie changes — HTTP headers, JS assignment, or extension writes — providing real-time coverage.

- [ ] **Step 1: Add `chrome.cookies.onChanged` listener to `background.js`**

After the existing `chrome.tabs.onUpdated` listener block, add:

```javascript
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
```

- [ ] **Step 2: Verify in Chrome**

1. Reload the extension (Extensions page → refresh icon).
2. Open the service worker console (Extensions page → "Inspect views: service worker") — no errors.
3. Navigate to a site that injects tracking cookies via ad scripts after load (e.g., a news/media site). Open DevTools → Application → Cookies and observe — tracking cookies should not accumulate.
4. Open Options, disable "Auto-apply preferences", save. Navigate again — cookies should now persist.
5. Re-enable auto-apply and save.

- [ ] **Step 3: Commit**

```
git add background.js
git commit -m "feat: add chrome.cookies.onChanged listener for real-time enforcement of post-load cookies"
```

---

### Task 6: Surface cookie removal failures

**Files:**
- Modify: `background.js` — `removeCookie` function and `DELETE_COOKIE`/`DELETE_CATEGORY` message handlers

`chrome.cookies.remove` returns `null` when the target cookie is not found (domain mismatch, already expired, wrong path). The current code discards this return value everywhere. Fix: make `removeCookie` return a boolean, propagate it through the message handlers, and log warnings in `applyPreferences`.

- [ ] **Step 1: Update `removeCookie` to return success/failure**

Replace `removeCookie` in `background.js`:

```javascript
async function removeCookie(cookie) {
  const scheme = cookie.secure ? 'https' : 'http';
  const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
  const result = await chrome.cookies.remove({ url: `${scheme}://${domain}${cookie.path}`, name: cookie.name });
  return result !== null;
}
```

- [ ] **Step 2: Add warning in `applyPreferences` when removal fails**

In `applyPreferences`, replace the `if (!allowed) await removeCookie(cookie);` line:

```javascript
      if (!allowed) {
        const removed = await removeCookie(cookie);
        if (!removed) {
          console.warn(`[Cookie Jar] Failed to remove "${cookie.name}" on ${cookie.domain} — check domain/path match`);
        }
      }
```

- [ ] **Step 3: Update `DELETE_COOKIE` to return actual success status**

In the `onMessage` listener, replace the `DELETE_COOKIE` case:

```javascript
    case 'DELETE_COOKIE':
      removeCookie(msg.cookie).then(ok => reply({ ok }));
      return true;
```

- [ ] **Step 4: Update `DELETE_CATEGORY` to report removed count vs total**

Replace the `DELETE_CATEGORY` case:

```javascript
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
```

- [ ] **Step 5: Verify in Chrome**

1. Open the service worker console (Extensions page → "Inspect views: service worker").
2. Navigate to a site and block a cookie category that has cookies.
3. If any removal fails, a `[Cookie Jar] Failed to remove` warning appears in the service worker console.
4. No warnings should appear for cookies that are successfully removed.

- [ ] **Step 6: Commit**

```
git add background.js
git commit -m "fix: removeCookie returns bool, failures logged as warnings, DELETE_CATEGORY reports removed count"
```

---

## Self-Review

**Spec coverage:**
- Issue 1 (duplicate classification patterns) → Task 1 ✓
- Issue 2 (fragmented DEFAULT_PREFS in 4 files) → Task 2 ✓
- Issue 3 (popup ignores prefs.mode) → Task 3 ✓
- Issue 4 (fullpage shows 3 of 8 categories) → Task 4 ✓
- Issue 5 (post-load cookies not caught) → Task 5 ✓
- Issue 6 (silent removal failures) → Task 6 ✓

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references. All code steps show complete code.

**Type consistency:**
- `CookiePrefs.mergePrefs(saved)` — introduced in Task 2 Step 1, used in Tasks 2, 3, 4. Consistent.
- `CookiePrefs.DEFAULT_PREFS` — introduced in Task 2 Step 1, used in Tasks 2, 3. Consistent.
- `removeCookie(cookie)` returns `boolean` — changed in Task 6 Step 1, consumed in Steps 2–4. Consistent.
- `CookieClassifier.isNecessaryCategory(cat)` — pre-existing, used in Tasks 3, 5. Consistent.
- `DELETE_CATEGORY` reply shape changes from `{ count }` to `{ count, removed }` — only written in Task 6 Step 4; no existing callers read the `count` field so no breakage.
