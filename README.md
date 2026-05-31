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

It also suppresses cookie consent banners automatically — the "accept all / manage preferences" dialogs that appear on most websites.

## Features

- **Auto-classification** — cookies are identified by name against a pattern library covering 50+ frameworks and platforms
- **Real-time blocking** — new cookies are intercepted as they're set, not just on page load
- **Consent banner suppression** — hides banners from OneTrust, CookieBot, TrustArc, Didomi, Quantcast, Shopify, Ketch, and 20+ other CMPs, including those rendered inside iframes
- **OAuth passlist** — Google, Microsoft, Apple, Okta, Auth0, and other identity providers are fully excluded so login flows are never interrupted
- **Per-domain pause** — disable the extension for a specific site without touching your global settings
- **Badge counter** — shows how many cookies were blocked on the current page
- **Simple / Advanced mode** — one toggle for necessary-only vs. full per-category control

## Installation (developer mode)

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `design-frontier` folder
5. Generate icon files by opening `icons/generate-icons.html` in your browser and downloading the PNGs to `icons/`

## Project structure

```
manifest.json              MV3 manifest — permissions, content script config
background.js              Service worker — cookie interception, CSS injection, badge
content.js                 Content script — banner suppression, cookie setter hook
utils/
  cookie-classifier.js     Pattern-based cookie categorizer
  prefs.js                 Default preferences and merge logic
popup/                     Toolbar popup UI
options/                   Settings page
fullpage/                  Onboarding / full cookie dashboard
icons/                     Extension icons + icon generator
```

## Testing consent banner suppression

```bash
npm install
node test-consent-banners.js
```

Launches Chrome with the extension loaded and visits 31 popular sites, reporting whether any consent UI is still visible. Screenshots are saved to `test-screenshots/`.

## Cookie categories in detail

Authentication cookies are preserved for all major platforms including Spotify, Reddit, Netflix, Amazon, Twitch, Discord, Twitter/X, TikTok, Instagram, Pinterest, GitHub, and all Google/Microsoft/Apple account cookies. The classifier recognizes standard web framework session cookies (Express, Django, Rails, Laravel, ASP.NET, Next.js, Supabase, and more).

Cookies that don't match any known pattern and are first-party are left alone (classified as `session`) rather than deleted by assumption.
