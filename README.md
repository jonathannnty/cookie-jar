# Cookie Jar

A Chrome extension that reads, classifies, and manages browser cookies — blocking the ones you don't want while keeping you logged in everywhere.

## What it does

Cookie Jar inspects every cookie a website sets and categorizes it automatically:

| Category | Default | Description |
|---|---|---|
| Necessary | ✅ Allowed | Core site functionality (security, navigation) |
| Session | ✅ Allowed | Temporary in-tab state |
| Authentication | ✅ Allowed | Keeps you logged in |
| Functional | ✅ Allowed | Your saved preferences (language, theme) |
| Analytics | ❌ Blocked | Site usage measurement |
| Tracking | ❌ Blocked | Behavioral profiling across sessions |
| Advertising | ❌ Blocked | Ad targeting and conversion tracking |
| Third-party | ❌ Blocked | Cookies from embedded external services |

It also automatically rejects cookie consent banners — the "accept all / manage preferences" dialogs that appear on most websites — by clicking "reject all" or writing a non-consent state directly, rather than just hiding the UI.

## Features

- **Auto-classification** — cookies are identified by name against a pattern library covering 50+ frameworks and platforms
- **Real-time blocking** — new cookies are intercepted as they're set, not just on page load
- **Auto-consent rejection** — uses the vendored DuckDuckGo autoconsent engine (v14.95.0, MPL-2.0) with the EasyList Cookie rules to click "reject all" on OneTrust, CookieBot, TrustArc, Didomi, Quantcast, Shopify, Ketch, and hundreds of other CMPs; falls back to CSS/JS banner hiding when auto-consent is disabled in settings
- **OAuth passlist** — Google, Microsoft, Apple, Okta, Auth0, and other identity providers are fully excluded so login flows are never interrupted
- **Consent-state preservation** — rejection cookies (OneTrust `OptanonConsent`, Cookiebot `CookieConsent`, IAB `euconsent-v2`, Didomi, TrustArc, etc.) are kept so a rejection is never silently undone by the blocker
- **Per-domain pause** — disable the extension for a specific site without touching your global settings
- **Badge counter** — shows how many cookies were blocked on the current page
- **Simple / Advanced mode** — one toggle for necessary-only vs. full per-category control

## Installation (developer mode)

1. Clone or download this repository
2. *(Optional — only needed to regenerate the vendored autoconsent engine)* Run:
   ```bash
   npm install
   npm run build
   ```
   The built artifacts in `vendor/autoconsent/` are committed to the repo, so you can skip this step and load the extension unpacked as-is.
3. Open `chrome://extensions` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `design-frontier` folder
6. Generate icon files by opening `icons/generate-icons.html` in your browser and downloading the PNGs to `icons/`

## Project structure

```
manifest.json              MV3 manifest — permissions, content script config
background.js              Service worker — cookie interception, CSS injection, badge
content.js                 Content script — banner suppression, cookie setter hook
utils/
  cookie-classifier.js     Pattern-based cookie categorizer
  prefs.js                 Default preferences and merge logic
popup/                     Toolbar popup UI (includes quick auto-consent toggle)
options/                   Settings page (auto-consent toggle + action choice)
fullpage/                  Onboarding / full cookie dashboard
icons/                     Extension icons + icon generator
src/autoconsent/
  background-helpers.entry.js  Build entry: autoconsent background helpers
  content.entry.js             Build entry: autoconsent content-side engine
scripts/
  build-autoconsent.mjs    Bundles the autoconsent engine into vendor/
vendor/autoconsent/
  content.bundle.js        Bundled autoconsent engine (content script)
  background-helpers.bundle.js  Bundled background helpers
  rules/                   Rule JSON files (EasyList Cookie + CMP rules)
  LICENSE                  MPL-2.0 license for the vendored code
test/
  cookie-classifier.test.js  Unit tests for cookie classifier
  prefs.test.js              Unit tests for preferences logic
test-consent-banners.cjs   Playwright integration harness (31 sites)
```

## Testing

### Unit tests

```bash
npm test
```

Runs 15 `node:test` unit tests covering the cookie classifier and preferences logic.

### Integration tests (consent banner harness)

```bash
# First run only — install the Chromium browser for Playwright:
npx playwright install chromium

npm run test:integration
```

Launches Chrome with the extension loaded and visits 31 popular sites via `test-consent-banners.cjs`, reporting whether any consent UI is still visible. Screenshots are saved to `test-screenshots/`.

## Cookie categories in detail

Authentication cookies are preserved for all major platforms including Spotify, Reddit, Netflix, Amazon, Twitch, Discord, Twitter/X, TikTok, Instagram, Pinterest, GitHub, and all Google/Microsoft/Apple account cookies. The classifier recognizes standard web framework session cookies (Express, Django, Rails, Laravel, ASP.NET, Next.js, Supabase, and more).

Cookies that don't match any known pattern and are first-party are left alone (classified as `session`) rather than deleted by assumption.

## Acknowledgements

- **[DuckDuckGo autoconsent](https://github.com/duckduckgo/autoconsent)** (v14.95.0) — vendored in `vendor/autoconsent/` under the [Mozilla Public License 2.0](vendor/autoconsent/LICENSE). The `/extra` build is used, which bundles the EasyList Cookie filterlist rules.
- **[EasyList Cookie List](https://easylist.to/)** — cookie consent filter rules bundled as part of the autoconsent `/extra` build. Licensed under CC BY-SA 3.0.
