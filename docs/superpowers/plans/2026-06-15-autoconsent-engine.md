# Auto-Consent Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Cookie Jar from cosmetic banner *hiding* to real *auto-consent* by vendoring DuckDuckGo's autoconsent engine (MPL-2.0, `optOut`), which actually rejects consent and unlocks cookie-wall sites, while keeping the existing hide layer as a fallback.

**Architecture:** A new isolated-world content script (`vendor/autoconsent/content.bundle.js`, built from `@duckduckgo/autoconsent/extra` via esbuild) detects the CMP and clicks "reject all". It talks to the existing `background.js` service worker, which answers `init` with per-URL rules + config and runs autoconsent's fixed MAIN-world snippet functions via `chrome.scripting.executeScript({ world: 'MAIN', func: evalSnippets[snippetId] })` — **no `eval`, no remote code**, so it stays Chrome-Web-Store-compliant. The `/extra` build bundles the EasyList Cookie filterlist, giving better cosmetic coverage than the current hardcoded list. **Design decision (coexistence):** autoconsent becomes the primary consent handler; Cookie Jar's legacy CSS/JS banner-hiding (`content.js` `suppressCookieBanners` + `background.js` `injectConsentCSS`) is **skipped when auto-consent is enabled** so its `display:none` never blocks autoconsent's reject clicks. The legacy hide remains the behavior only when the user turns auto-consent off. autoconsent's own `enablePrehide` kills flicker in the enabled path.

**Tech Stack:** MV3 Chrome extension (plain JS, classic service worker via `importScripts`). New: Node + npm, `esbuild` (bundler), `@duckduckgo/autoconsent` v14.95.0 (MPL-2.0), `node:test` (unit tests, no dependency), `playwright` (existing integration harness).

---

## File Structure

**New files:**
- `package.json` — npm manifest: dev deps + build/test scripts. The built artifacts under `vendor/autoconsent/` are **committed** (extension must load unpacked without a build step); `node_modules/` is git-ignored.
- `.gitignore` — ignore `node_modules/`.
- `scripts/build-autoconsent.mjs` — esbuild bundling + rules-copy script.
- `src/autoconsent/content.entry.js` — esbuild entry → `vendor/autoconsent/content.bundle.js`.
- `src/autoconsent/background-helpers.entry.js` — esbuild entry → `vendor/autoconsent/background-helpers.bundle.js` (exposes `evalSnippets` + `filterCompactRules` on `self`).
- `vendor/autoconsent/content.bundle.js` — built; isolated-world content script (committed).
- `vendor/autoconsent/background-helpers.bundle.js` — built; `importScripts`-ed by `background.js` (committed).
- `vendor/autoconsent/rules/compact-rules.json`, `rules.json`, `consentomatic.json` — copied from the package (committed).
- `vendor/autoconsent/LICENSE` — autoconsent's MPL-2.0 license text (attribution).
- `test/cookie-classifier.test.js` — `node:test` unit tests for the classifier.
- `test/prefs.test.js` — `node:test` unit tests for prefs merge.

**Modified files:**
- `utils/cookie-classifier.js` — add CMP consent-state cookies to `necessary` patterns.
- `utils/prefs.js` — add `autoConsent` to `DEFAULT_PREFS` + `mergePrefs`.
- `manifest.json` — `match_about_blank` on the existing content script; new content-script entry for the autoconsent bundle.
- `background.js` — `importScripts` the helpers bundle; autoconsent message handlers; rule loading; gate `injectConsentCSS` on `autoConsent` pref.
- `content.js` — skip `suppressCookieBanners` when `autoConsent` is enabled.
- `options/options.html`, `options/options.js` — auto-consent toggle + action selector.
- `popup/popup.html`, `popup/popup.js` — quick auto-consent toggle.
- `test-consent-banners.js` — assert opt-out succeeded, not just that the banner is hidden.
- `README.md` — document the engine, build step, and attribution.

---

## Task 1: Tooling foundation (npm + esbuild + node:test)

**Files:**
- Create: `package.json`, `.gitignore`
- Create: `test/smoke.test.js` (temporary sanity test, removed in Task 2)

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
.playwright-mcp/
test-screenshots/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "cookie-jar",
  "version": "1.0.0",
  "private": true,
  "description": "Cookie Jar Chrome extension build/test tooling.",
  "type": "module",
  "scripts": {
    "build": "node scripts/build-autoconsent.mjs",
    "test": "node --test test/",
    "test:integration": "node test-consent-banners.js"
  },
  "devDependencies": {
    "@duckduckgo/autoconsent": "14.95.0",
    "esbuild": "^0.23.0",
    "playwright": "^1.45.0"
  }
}
```

- [ ] **Step 3: Write a temporary smoke test** at `test/smoke.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node:test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Install and verify the toolchain**

Run: `npm install`
Expected: completes; `node_modules/@duckduckgo/autoconsent/dist/autoconsent.extra.esm.js` exists.

Run: `node -e "import('@duckduckgo/autoconsent').then(m => console.log('default:', typeof m.default, 'evalSnippets:', typeof m.evalSnippets, 'filterCompactRules:', typeof m.filterCompactRules))"`
Expected: `default: function evalSnippets: object filterCompactRules: function`
(This confirms the exact exports this plan depends on. If `evalSnippets` is not `object` or `filterCompactRules` not `function`, STOP and report — the integration in Tasks 5/6 assumes these.)

Run: `npm test`
Expected: `tests 1 / pass 1 / fail 0`.

- [ ] **Step 5: Confirm the package rule files exist** (used in Task 5)

Run: `node -e "for (const f of ['compact-rules.json','rules.json','consentomatic.json']) require('node:fs').accessSync(require.resolve('@duckduckgo/autoconsent/rules/'+f))" && echo OK`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore test/smoke.test.js
git commit -m "build: add npm tooling, esbuild, autoconsent dep, node:test runner"
```

---

## Task 2: Harden cookie classifier to preserve all CMP consent-state cookies

**Context:** Once autoconsent writes a reject decision, the CMP stores it in a first-party consent cookie. Deleting that cookie re-triggers the banner and undoes the opt-out. Most are already classified `necessary`, and unmatched first-party cookies fall back to `session` (also preserved) — but add the well-known consent-record names explicitly so intent is unambiguous and regressions are caught by tests.

**Files:**
- Modify: `utils/cookie-classifier.js` (the `PATTERNS.necessary` array, currently `cookie-classifier.js:82-91`)
- Create: `test/cookie-classifier.test.js`
- Delete: `test/smoke.test.js`

- [ ] **Step 1: Write failing tests** at `test/cookie-classifier.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// cookie-classifier.js is a classic script exposing a global `CookieClassifier`
// via an IIFE assigned to a const. Load it into a sandbox and read that const.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../utils/cookie-classifier.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.CookieClassifier = CookieClassifier;', sandbox);
const { CookieClassifier } = sandbox;

const NECESSARY_CONSENT_COOKIES = [
  'OptanonConsent', 'OptanonAlertBoxClosed',   // OneTrust
  'CookieConsent',                              // Cookiebot
  'euconsent-v2', 'euconsent',                  // IAB TCF
  'didomi_token', 'didomi_dcs',                 // Didomi
  'addtl_consent',                              // Google Additional Consent
  'CONSENT',                                    // Google
  'cmapi_cookie_privacy', 'notice_gdpr_prefs',  // TrustArc
  'usprivacy',                                  // US Privacy
];

for (const name of NECESSARY_CONSENT_COOKIES) {
  test(`consent-state cookie "${name}" is classified necessary (never deleted)`, () => {
    const { category } = CookieClassifier.classifyCookie(
      { name, domain: 'example.com', expirationDate: Date.now() / 1000 + 86400 },
      'example.com',
    );
    assert.ok(
      CookieClassifier.isNecessaryCategory(category),
      `${name} -> ${category} (expected a necessary-group category)`,
    );
  });
}
```

- [ ] **Step 2: Run tests to verify failures**

Run: `node --test test/cookie-classifier.test.js`
Expected: FAIL on `didomi_token`, `didomi_dcs`, `addtl_consent`, `notice_gdpr_prefs` (these are not yet matched; `addtl_consent`/`didomi_*` currently fall to `session` which IS necessary — confirm which actually fail and proceed; goal is explicit coverage).

- [ ] **Step 3: Add the patterns** to `PATTERNS.necessary` in `utils/cookie-classifier.js`. Insert after the existing line `/^OptanonConsent$/, /^OptanonAlertBoxClosed$/,`:

```js
      // Didomi consent record
      /^didomi_token$/, /^didomi_dcs$/,
      // Google Additional Consent (rides alongside euconsent-v2)
      /^addtl_consent$/,
      // TrustArc consent record
      /^notice_gdpr_prefs$/, /^notice_preferences$/, /^TAconsentID$/, /^cmapi_gtm_bl$/,
      /^euconsent$/,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/cookie-classifier.test.js`
Expected: all `consent-state cookie ... is necessary` tests PASS.

- [ ] **Step 5: Remove the temporary smoke test**

Run: `git rm test/smoke.test.js`

- [ ] **Step 6: Run the whole suite + commit**

Run: `npm test`
Expected: all pass.

```bash
git add utils/cookie-classifier.js test/cookie-classifier.test.js
git commit -m "fix: explicitly preserve Didomi/TrustArc/AC consent cookies from deletion"
```

---

## Task 3: Add `autoConsent` preference

**Context:** A single source of truth for whether the engine runs and which action it takes. `background.js` and `content.js` both read this to gate behavior. `mergePrefs` must deep-merge the new nested object so existing saved prefs (which lack `autoConsent`) still get defaults.

**Files:**
- Modify: `utils/prefs.js` (`utils/prefs.js:5-30`)
- Create: `test/prefs.test.js`

- [ ] **Step 1: Write failing tests** at `test/prefs.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../utils/prefs.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.CookiePrefs = CookiePrefs;', sandbox);
const { CookiePrefs } = sandbox;

test('DEFAULT_PREFS enables auto-consent with optOut', () => {
  assert.equal(CookiePrefs.DEFAULT_PREFS.autoConsent.enabled, true);
  assert.equal(CookiePrefs.DEFAULT_PREFS.autoConsent.action, 'optOut');
});

test('mergePrefs backfills autoConsent for old saved prefs', () => {
  const merged = CookiePrefs.mergePrefs({ mode: 'advanced' }); // saved prefs without autoConsent
  assert.equal(merged.autoConsent.enabled, true);
  assert.equal(merged.autoConsent.action, 'optOut');
  assert.equal(merged.mode, 'advanced'); // saved value preserved
});

test('mergePrefs preserves a user-disabled autoConsent', () => {
  const merged = CookiePrefs.mergePrefs({ autoConsent: { enabled: false } });
  assert.equal(merged.autoConsent.enabled, false);
  assert.equal(merged.autoConsent.action, 'optOut'); // default backfilled for missing sub-key
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/prefs.test.js`
Expected: FAIL — `autoConsent` is undefined.

- [ ] **Step 3: Edit `utils/prefs.js`.** Add the `autoConsent` block to `DEFAULT_PREFS` (after the `simple: { ... }` block):

```js
    simple: {
      necessary: true,
      optional:  false,
    },
    autoConsent: {
      enabled: true,
      action:  'optOut', // 'optOut' rejects; 'optIn' accepts (advanced)
    },
```

And add a deep-merge line to `mergePrefs` (inside the `Object.assign` third argument):

```js
  function mergePrefs(saved) {
    return Object.assign({}, DEFAULT_PREFS, saved, {
      categories:  Object.assign({}, DEFAULT_PREFS.categories, saved?.categories),
      simple:      Object.assign({}, DEFAULT_PREFS.simple,     saved?.simple),
      autoConsent: Object.assign({}, DEFAULT_PREFS.autoConsent, saved?.autoConsent),
    });
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/prefs.test.js`
Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/prefs.js test/prefs.test.js
git commit -m "feat: add autoConsent preference (default enabled, optOut)"
```

---

## Task 4: Add `match_about_blank` to the existing content script

**Context:** Lets the existing `content.js` (and later the autoconsent script that reuses this matching) reach `about:blank` and same-origin nested frames some CMPs use. One-line, low-risk.

**Files:**
- Modify: `manifest.json` (the `content_scripts[0]` object, `manifest.json:47-83`)

- [ ] **Step 1: Edit `manifest.json`.** In the first `content_scripts` entry, add `"match_about_blank": true` after `"all_frames": true`:

```json
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: match_about_blank on content script for nested-frame banners"
```

---

## Task 5: Build the autoconsent bundles and vendor the rules

**Context:** esbuild turns two tiny entry files into browser-loadable bundles and copies the rule JSON the engine needs. Built artifacts are committed so the extension loads unpacked without a build step. The content bundle uses the `/extra` entry (filterlist/EasyList). The background-helpers bundle exposes the two named exports the service worker needs on `self`.

**Files:**
- Create: `src/autoconsent/content.entry.js`
- Create: `src/autoconsent/background-helpers.entry.js`
- Create: `scripts/build-autoconsent.mjs`
- Create (by build): `vendor/autoconsent/content.bundle.js`, `vendor/autoconsent/background-helpers.bundle.js`, `vendor/autoconsent/rules/*.json`, `vendor/autoconsent/LICENSE`

- [ ] **Step 1: Create `src/autoconsent/content.entry.js`** (mirrors the reference `addon/content.ts`, isolated world)

```js
// Isolated-world content script. Instantiated with only a sendMessage callback;
// rules + config arrive from the background via the 'initResp' message.
import AutoConsent from '@duckduckgo/autoconsent/extra';

const consent = new AutoConsent(
  (message) => chrome.runtime.sendMessage(message),
  null, // config comes from background initResp
  null, // rules come from background initResp
);

chrome.runtime.onMessage.addListener((message) =>
  Promise.resolve(consent.receiveMessageCallback(message)),
);

// Lets the background detect frame teardown (matches the reference addon).
chrome.runtime.connect({ name: `instance-${consent.id}` });
```

- [ ] **Step 2: Create `src/autoconsent/background-helpers.entry.js`**

```js
// Bundled to an IIFE and importScripts-ed by the classic service worker.
// Exposes the two named exports background.js needs on the worker global.
import { evalSnippets, filterCompactRules } from '@duckduckgo/autoconsent';

self.autoconsentEvalSnippets = evalSnippets;
self.autoconsentFilterCompactRules = filterCompactRules;
```

- [ ] **Step 3: Create `scripts/build-autoconsent.mjs`**

```js
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'vendor', 'autoconsent');
const rulesOut = path.join(outDir, 'rules');
mkdirSync(rulesOut, { recursive: true });

await build({
  entryPoints: {
    'content.bundle': path.join(root, 'src/autoconsent/content.entry.js'),
    'background-helpers.bundle': path.join(root, 'src/autoconsent/background-helpers.entry.js'),
  },
  bundle: true,
  format: 'iife',
  target: 'chrome102',
  outdir: outDir,
  legalComments: 'inline',
});

for (const f of ['compact-rules.json', 'rules.json', 'consentomatic.json']) {
  copyFileSync(require.resolve('@duckduckgo/autoconsent/rules/' + f), path.join(rulesOut, f));
}
copyFileSync(
  require.resolve('@duckduckgo/autoconsent/package.json').replace(/package\.json$/, 'LICENSE'),
  path.join(outDir, 'LICENSE'),
);
console.log('autoconsent build complete ->', outDir);
```

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: `autoconsent build complete -> .../vendor/autoconsent`. Files exist: `vendor/autoconsent/content.bundle.js`, `vendor/autoconsent/background-helpers.bundle.js`, `vendor/autoconsent/rules/{compact-rules,rules,consentomatic}.json`, `vendor/autoconsent/LICENSE`.

- [ ] **Step 5: Sanity-check the bundles**

Run: `node --check vendor/autoconsent/content.bundle.js && node --check vendor/autoconsent/background-helpers.bundle.js && echo "syntax ok"`
Expected: `syntax ok`

Run: `node -e "globalThis.self=globalThis; require('./vendor/autoconsent/background-helpers.bundle.js'); console.log('snippets:', typeof self.autoconsentEvalSnippets, 'filter:', typeof self.autoconsentFilterCompactRules)"`
Expected: `snippets: object filter: function`
(If this throws because the bundle references browser-only globals at load time, instead verify by grepping the bundle for `autoconsentEvalSnippets` and `autoconsentFilterCompactRules` assignments and note that runtime verification happens in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add scripts/build-autoconsent.mjs src/autoconsent/ vendor/autoconsent/
git commit -m "build: vendor autoconsent content + helper bundles and rules"
```

---

## Task 6: Wire autoconsent into the background service worker

**Context:** The background answers the engine's `init` with per-URL rules + config (gated by OAuth passlist, paused domains, and the `autoConsent` pref), runs `eval` snippets in the MAIN world, and gates the legacy `injectConsentCSS` off when auto-consent is enabled. Loads rule JSON lazily and caches it (the SW can restart).

**Files:**
- Modify: `background.js` — add `importScripts` (top, `background.js:1-4`), a new "Autoconsent engine" section, an `init`/`eval` message branch, and a pref check in `injectConsentCSS`/its callers.

- [ ] **Step 1: Import the helpers bundle.** At the top of `background.js`, after the existing `importScripts` lines:

```js
importScripts('./utils/cookie-classifier.js');
importScripts('./utils/prefs.js');
importScripts('./vendor/autoconsent/background-helpers.bundle.js');
```

- [ ] **Step 2: Add the autoconsent engine section** (place it after the `injectConsentCSS` definition, ~`background.js:169`):

```js
// ── Autoconsent engine ───────────────────────────────────────────────────────
// Vendored DuckDuckGo autoconsent (MPL-2.0). The isolated-world content bundle
// detects the CMP and clicks "reject all"; this worker supplies rules/config and
// runs the engine's fixed MAIN-world snippet functions (no eval / remote code).
let _compactRules = null;
let _consentomatic = null;

async function loadAutoconsentRules() {
  if (_compactRules && _consentomatic) return;
  const [compact, com] = await Promise.all([
    fetch(chrome.runtime.getURL('vendor/autoconsent/rules/compact-rules.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('vendor/autoconsent/rules/consentomatic.json')).then(r => r.json()),
  ]);
  _compactRules = compact;
  _consentomatic = com;
}

function autoconsentConfig(prefs, enabled) {
  return {
    enabled,
    autoAction: prefs.autoConsent.action,      // 'optOut'
    disabledCmps: [],
    enablePrehide: true,
    enableCosmeticRules: true,
    enableFilterList: true,
    detectRetries: 20,
    isMainWorld: false,
    prehideTimeout: 2000,
    visualTest: false,
    logs: { lifecycle: false, rulesteps: false, evals: false, errors: false, messages: false },
  };
}

async function isAutoconsentEnabledFor(hostname) {
  if (isOAuthDomain(hostname)) return false;
  const [prefs, paused] = await Promise.all([getPrefs(), getPausedDomains()]);
  if (!prefs.autoConsent.enabled) return false;
  if (paused.has(hostname)) return false;
  return true;
}

function evalAutoconsentSnippet(tabId, frameId, snippetId) {
  return chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    func: self.autoconsentEvalSnippets[snippetId],
  });
}

// Returns true if the message was an autoconsent message and was handled.
async function handleAutoconsentMessage(msg, sender) {
  if (!sender.tab) return false;
  const tabId = sender.tab.id;
  const frameId = sender.frameId;
  switch (msg.type) {
    case 'init': {
      const senderUrl = sender.url || `${sender.origin}/`;
      let hostname;
      try { hostname = new URL(senderUrl).hostname; } catch { return true; }
      const [prefs] = await Promise.all([getPrefs(), loadAutoconsentRules()]);
      const enabled = await isAutoconsentEnabledFor(hostname);
      const compact = self.autoconsentFilterCompactRules(_compactRules, {
        url: senderUrl,
        mainFrame: frameId === 0,
      });
      chrome.tabs.sendMessage(tabId, {
        type: 'initResp',
        rules: { autoconsent: [], consentomatic: _consentomatic, compact },
        config: autoconsentConfig(prefs, enabled),
      }, { frameId });
      return true;
    }
    case 'eval': {
      const [res] = await evalAutoconsentSnippet(tabId, frameId, msg.snippetId);
      chrome.tabs.sendMessage(tabId, { id: msg.id, type: 'evalResp', result: res.result }, { frameId });
      return true;
    }
    // Notifications we acknowledge but don't need to act on for opt-out:
    case 'popupFound':
    case 'optOutResult':
    case 'optInResult':
    case 'autoconsentDone':
    case 'selfTestResult':
    case 'autoconsentError':
    case 'report':
    case 'visualDelay':
      return true;
    default:
      return false;
  }
}
```

- [ ] **Step 3: Route autoconsent messages.** The existing `chrome.runtime.onMessage.addListener` (`background.js:415`) uses a `switch` with `return true/false` for async. Add a guard at the **top** of that listener callback, before the `switch (msg.type)`:

```js
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Autoconsent engine messages (init/eval/notifications) are handled separately.
  const AUTOCONSENT_TYPES = new Set(['init','eval','popupFound','optOutResult','optInResult','autoconsentDone','selfTestResult','autoconsentError','report','visualDelay']);
  if (AUTOCONSENT_TYPES.has(msg?.type)) {
    handleAutoconsentMessage(msg, sender);
    return false; // we reply via chrome.tabs.sendMessage, not the callback
  }
  switch (msg.type) {
    // ... existing cases unchanged ...
```

- [ ] **Step 4: Gate legacy CSS injection.** Wrap the two `injectConsentCSS(tabId)` call sites so they only run when auto-consent is OFF. In `chrome.tabs.onUpdated` (`background.js:347-354`) change:

```js
    if (!oauthPage) {
      applyPreferences(tab.url, tabId);
      if (tab.url.startsWith('http')) {
        isAutoconsentEnabledFor(new URL(tab.url).hostname).then(on => { if (!on) injectConsentCSS(tabId); });
      }
    }
```

And in `chrome.webNavigation.onCommitted` (`background.js:362-367`) change the final line:

```js
  try { if (isOAuthDomain(new URL(url).hostname)) return; } catch (_) { return; }
  isAutoconsentEnabledFor(new URL(url).hostname).then(on => { if (!on) injectConsentCSS(tabId); });
```

- [ ] **Step 5: Syntax-check**

Run: `node --check background.js && echo ok`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add background.js
git commit -m "feat: autoconsent init/eval handlers + gate legacy CSS when engine on"
```

---

## Task 7: Register the autoconsent content script + gate legacy hide in content.js

**Context:** Register the built content bundle as a second content script and make `content.js`'s `suppressCookieBanners` stand down when auto-consent is enabled (so its `display:none` cannot block reject clicks). `content.js` runs at `document_start` and can't read prefs synchronously; it asks the background and only installs the legacy hide if auto-consent is off.

**Files:**
- Modify: `manifest.json` — second `content_scripts` entry.
- Modify: `content.js` — guard `suppressCookieBanners` (`content.js:10-259`).

- [ ] **Step 1: Add the content-script registration** to `manifest.json` `content_scripts` (append a second object, reusing the same `exclude_matches` OAuth list as the first entry):

```json
    {
      "matches": ["http://*/*", "https://*/*"],
      "exclude_matches": [
        "https://accounts.google.com/*",
        "https://login.microsoftonline.com/*",
        "https://login.live.com/*",
        "https://account.live.com/*",
        "https://login.windows.net/*",
        "https://account.microsoft.com/*",
        "https://accounts.microsoft.com/*",
        "https://appleid.apple.com/*",
        "https://auth.apple.com/*",
        "https://idmsa.apple.com/*",
        "https://gsa.apple.com/*",
        "https://auth.atlassian.com/*",
        "https://id.atlassian.com/*",
        "https://login.atlassian.net/*",
        "https://login.salesforce.com/*",
        "https://identity.salesforce.com/*",
        "https://auth.services.mozilla.com/*",
        "https://accounts.firefox.com/*",
        "*://*.okta.com/*",
        "*://*.oktapreview.com/*",
        "*://*.auth0.com/*",
        "*://*.onelogin.com/*",
        "*://*.pingidentity.com/*",
        "*://*.duosecurity.com/*",
        "*://*.duo.com/*",
        "*://*.forgerock.io/*",
        "*://*.forgerock.com/*"
      ],
      "js": ["vendor/autoconsent/content.bundle.js"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true
    }
```

- [ ] **Step 2: Add `vendor/autoconsent/content.bundle.js` to `web_accessible_resources`** is **not** required (it's a registered content script, not page-fetched). Leave `web_accessible_resources` unchanged. Validate JSON:

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Guard the legacy hide in `content.js`.** Wrap the IIFE `suppressCookieBanners` so it only installs when auto-consent is OFF. Change the opening (`content.js:10`) from an immediately-invoked function to a named function plus a gate:

Replace `(function suppressCookieBanners() {` ... and its closing `})();` (`content.js:259`) so the function is *defined* but invoked only after a pref check. At the very top of the file (after `'use strict';`) add:

```js
// Ask the background whether auto-consent is enabled for this frame's domain.
// When enabled, the vendored autoconsent engine owns banner handling and the
// legacy CSS/JS hide below must stand down (its display:none would block the
// engine's reject clicks). When disabled, install the legacy hide immediately.
function shouldRunLegacyHide() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'IS_AUTOCONSENT_ON', url: location.href }, (resp) => {
        if (chrome.runtime.lastError) return resolve(true); // background unavailable -> safe fallback
        resolve(!(resp && resp.on));
      });
    } catch (_) { resolve(true); }
  });
}
```

Change `(function suppressCookieBanners() {` to `function suppressCookieBanners() {` and change the closing `})();` (line 259) to `}` followed by:

```js
shouldRunLegacyHide().then((run) => { if (run) suppressCookieBanners(); });
```

- [ ] **Step 4: Add the `IS_AUTOCONSENT_ON` handler** to `background.js`'s main `onMessage` switch (a new `case` alongside the existing ones):

```js
    case 'IS_AUTOCONSENT_ON': {
      let host = '';
      try { host = new URL(msg.url).hostname; } catch (_) {}
      isAutoconsentEnabledFor(host).then(on => reply({ on }));
      return true;
    }
```

- [ ] **Step 5: Syntax-check both files**

Run: `node --check content.js && node --check background.js && echo ok`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add manifest.json content.js background.js
git commit -m "feat: register autoconsent content script; legacy hide yields when engine on"
```

---

## Task 8: Auto-consent toggle in options + popup

**Context:** Let users see/control the engine. Options page gets a labeled toggle (enable/disable) and an action choice (Reject / Accept). Popup gets a quick enable toggle. Persist to `chrome.storage.sync` under `preferences.autoConsent` using the same save flow the page already uses for other prefs. Match the existing markup/handler patterns in `options/options.{html,js}` (e.g., the Simple/Advanced toggle) and `popup/popup.{html,js}` — read those files first.

**Files:**
- Modify: `options/options.html`, `options/options.js`
- Modify: `popup/popup.html`, `popup/popup.js`

- [ ] **Step 1: Read the existing toggle pattern.** Open `options/options.html` + `options/options.js` and identify how an existing boolean preference (e.g. `mode` or a category checkbox) is rendered, loaded, and saved. Reuse that exact pattern.

- [ ] **Step 2: Add the options UI.** In `options/options.html`, add a section:

```html
<section class="setting-group">
  <h2>Cookie consent banners</h2>
  <label class="toggle-row">
    <input type="checkbox" id="autoConsentEnabled">
    <span>Automatically reject cookie consent banners</span>
  </label>
  <label class="toggle-row" id="autoConsentActionRow">
    <span>When a banner appears:</span>
    <select id="autoConsentAction">
      <option value="optOut">Reject all (recommended)</option>
      <option value="optIn">Accept all</option>
    </select>
  </label>
</section>
```

- [ ] **Step 3: Wire `options/options.js`.** On load, set `autoConsentEnabled.checked = prefs.autoConsent.enabled` and `autoConsentAction.value = prefs.autoConsent.action`. On change, update `prefs.autoConsent` and save via the page's existing save function (the same one used by other settings). Follow the file's existing load/save structure.

- [ ] **Step 4: Add the popup quick toggle.** In `popup/popup.html` add a labeled checkbox `#popupAutoConsent`; in `popup/popup.js`, load its state from prefs and on change persist `preferences.autoConsent.enabled` using the popup's existing prefs-write path.

- [ ] **Step 5: Manual verification (documented for the reviewer).** Load the unpacked extension (`chrome://extensions` → Load unpacked → the worktree folder). Open Options: toggle reflects default ON / optOut. Toggle off, reload Options — state persists. Toggle in popup reflects and updates the same value.

- [ ] **Step 6: Commit**

```bash
git add options/options.html options/options.js popup/popup.html popup/popup.js
git commit -m "feat: auto-consent toggle in options and popup"
```

---

## Task 9: Integration verification — opt-out actually happens

**Context:** The existing `test-consent-banners.js` only checks that consent UI is *hidden*. Extend it to also confirm the engine *acted* (opt-out), which is the whole point of this work. This is the acceptance gate.

**Files:**
- Modify: `test-consent-banners.js`

- [ ] **Step 1: Add an opt-out assertion.** After the existing per-site banner-visibility check, query the page for autoconsent's outcome. The engine sets a detectable state; the most robust cross-CMP signal is "no consent dialog visible AND the page is interactive (no scroll-lock)". Add, per site, a check that `document.documentElement` / `body` is not `overflow:hidden` locked and that no element matching the consent selectors is visible — and record CMP detection from console. Concretely, collect autoconsent console reports by listening for them:

```js
// near page setup
const acReports = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('autoconsent') || t.includes('CMP')) acReports.push(t);
});
```

And in the per-site result, record both `bannerVisible` (existing) and `scrollLocked`:

```js
const scrollLocked = await page.evaluate(() => {
  const o = getComputedStyle(document.body).overflow;
  return o === 'hidden' && document.body.scrollHeight > window.innerHeight;
});
```

Report a site as PASS only when `!bannerVisible && !scrollLocked`.

- [ ] **Step 2: Run the harness** (requires Chrome via Playwright; this loads the *built* extension from the worktree root, which now includes `vendor/autoconsent/`).

Run: `npm run test:integration`
Expected: the run completes and prints a per-site table. Target: a clear majority of the OneTrust/Cookiebot/CookieYes/Quantcast/Sourcepoint/Didomi sites show PASS (banner gone AND not scroll-locked). Record the pass rate and any regressions vs. the pre-change baseline in the commit message.

- [ ] **Step 3: Triage failures.** For any site where the banner persists, capture which CMP and whether autoconsent detected it (from `acReports`). Note (do not necessarily fix now) shadow-DOM/closed-root or cross-origin-iframe cases — those are the out-of-scope Stage 3 cases. If a *standard-DOM* CMP that autoconsent supports still fails, that's an integration bug to fix before closing.

- [ ] **Step 4: Commit**

```bash
git add test-consent-banners.js
git commit -m "test: assert opt-out (banner gone + no scroll-lock), not just hidden"
```

---

## Task 10: Docs + attribution

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`.** Replace the "Consent banner suppression" bullet and the build/test instructions to reflect: auto-consent via vendored `@duckduckgo/autoconsent` (MPL-2.0) with reject-all; the `npm install && npm run build` step that regenerates `vendor/autoconsent/`; and that `vendor/autoconsent/` is committed so the extension loads unpacked as-is. Add an "Acknowledgements / Licenses" section crediting autoconsent (MPL-2.0, link to `vendor/autoconsent/LICENSE`) and EasyList Cookie.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document auto-consent engine, build step, and attribution"
```

---

## Self-Review Checklist (run before execution)

- **Spec coverage:** Stage 1 (EasyList cosmetic → via `/extra` filterlist in Task 5/6; consent-cookie hardening → Task 2; `match_about_blank` → Tasks 4 & 7) and Stage 2 (vendored autoconsent `optOut` → Tasks 5–7; MV3-safe snippet eval → Task 6; prefs/UI → Tasks 3 & 8; verification → Task 9). ✓
- **Out of scope (Stage 3, intentionally not here):** MAIN-world `attachShadow` override for *closed* shadow roots; direct `__tcfapi` cross-frame seeding beyond what autoconsent already does. Noted in Task 9 triage.
- **Type/name consistency:** `autoConsent.{enabled,action}` (Tasks 3,6,7,8); `self.autoconsentEvalSnippets` + `self.autoconsentFilterCompactRules` (Tasks 5,6); message types `init`/`initResp`/`eval`/`evalResp`/`IS_AUTOCONSENT_ON` (Tasks 6,7). ✓
- **Risk to watch:** `@ghostery/adblocker` in the `/extra` build must not use `eval`/`new Function` under the content-script CSP — the existence of autoconsent's own MV3 reference addon indicates it's MV3-safe, but Task 5 Step 5 + Task 9 are the real verification. If the content bundle throws a CSP error at runtime, fall back to the base `@duckduckgo/autoconsent` entry (drop `enableFilterList`) and keep the legacy hide enabled as the cosmetic layer.
