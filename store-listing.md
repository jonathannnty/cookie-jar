# Cookie Jar — Chrome Web Store Listing

## Short Description
*(132-character limit — appears in search results)*

Automatically blocks tracking and advertising cookies while keeping you logged in everywhere. 100% on-device. No accounts.

---

## Full Description

Cookie Jar puts you in control of what websites store in your browser — without breaking the sites you rely on.

Every time you visit a website, it quietly sets dozens of cookies. Some are essential: they keep you logged in, remember your preferences, and make the site work. Others silently track your activity across the web, build behavioral profiles, and feed advertising networks — without ever asking permission. Cookie Jar sorts them out automatically and blocks the ones you don't want, in real time, on every page you visit.


WHAT IT DOES

Cookie Jar reads each cookie by name and classifies it into one of eight categories using a built-in pattern library that recognizes cookies from 50+ ad platforms, analytics services, identity providers, and web frameworks. Cookies you want are left alone. Cookies you don't are blocked before they're stored.

Classification happens entirely on your device — no cookie names, domains, or metadata are ever sent to any server.


COOKIE CATEGORIES

- Necessary
Core site functionality — security tokens, navigation state, CSRF protection. Always allowed. These make websites work.

- Session
Temporary in-tab state — shopping carts, form progress, video playback position. They disappear when you close your browser and cause no harm.

- Authentication
Keeps you logged into every site you use. Always preserved so you're never unexpectedly signed out.

- Functional
Your saved preferences — language, region, dark/light mode, layout choices. These stay within the site you're visiting and don't follow you elsewhere.

- Tracking
Behavioral profiling across sessions — cross-site tracking scripts and ad network beacons built specifically to follow your activity across the entire web.

- Advertising
Ad targeting cookies set by ad networks (not the site you're on) to track your browsing history and serve you retargeted ads everywhere you go.

- Analytics
Usage measurement — web analytics platforms, session recording tools, and similar services that aggregate your behavior into profiles that may be shared or sold to third parties.

- Third-Party
Cookies from embedded external services — social media buttons, map widgets, live chat tools, affiliate trackers, and other content loaded from external domains.


FEATURES

- Real-time blocking
Cookies are intercepted as they're set — not cleaned up after the page has already loaded. Cookies set dynamically by JavaScript are caught too, so there are no gaps in coverage.

- Automatic consent rejection
Cookie Jar doesn't just hide the "Accept all / Manage preferences" overlays — it automatically clicks "reject" for you, opting you out of non-essential cookies so cookie-wall pages unlock and tracking stays off. Powered by the open-source DuckDuckGo autoconsent engine plus the community EasyList cookie filter list, it handles the major consent management platforms — including banners rendered inside iframes — entirely on your device. Prefer it not to act on a particular site? One click turns auto-reject off and it falls back to simply hiding banners.

- Login protection
Major identity providers and SSO services are fully excluded from cookie management so your login flows are never interrupted. OAuth redirects work exactly as they should.

- Per-domain pause
Disable Cookie Jar for a specific site with one click from the popup, without touching your global preferences. Useful for sites that legitimately need stricter cookie access, or any time you want to step back temporarily.

- Cookie Statistics
See exactly what's been blocked across your entire browsing history — visualized as charts by website, over time, or broken down by category. Filter by today, this week, this month, this year, or all time. Export your full blocked cookie log as a CSV file at any time.

- Customize Rules
Fine-tune precisely what gets blocked:
• Per-domain overrides — allow analytics on a site you trust while blocking it everywhere else, or block a category on a specific site that your global settings normally allow
• Block by cookie name pattern — use wildcards to target specific cookies by name (e.g. _ga* blocks _ga, _ga_abc, and any other name starting with _ga). Common patterns for major analytics and ad trackers are provided as one-click presets
• Block persistent cookies — automatically block any cookie with an expiry longer than a chosen number of days, regardless of its category

- Settings export & import
Back up your full preferences as a JSON file and restore them instantly on a new device, after reinstalling, or to share a configuration with someone else.

- Badge counter
The extension icon shows how many cookies were blocked on the current page, so you always know what's happening behind the scenes.

- Keyboard shortcut
Open Cookie Jar instantly with Ctrl+Shift+Y on Windows and Linux, or Cmd+Shift+Y on Mac.

- Cookie education dashboard
The full-page view includes a detailed, plain-language guide to every cookie category — what each type does, why it matters, and real-world examples from sites you already use. Understand the difference between a session cookie that keeps your cart intact and an advertising cookie that follows you across hundreds of websites.


PRIVACY

Cookie Jar collects nothing and sends nothing.

All data the extension generates — your preferences, custom rules, per-domain overrides, and the blocked cookie log used for Statistics — is stored exclusively in your browser using Chrome's local storage API. It never leaves your device and is not accessible to anyone but you.

The extension itself contains no analytics, no crash reporting, and no advertising integrations of any kind. Cookie values are never read. Only cookie names, domains, and metadata are examined — locally — to perform classification. There are no external API calls.


PERMISSIONS EXPLAINED

Cookie Jar requests only the permissions necessary to function:

• cookies — to read cookie metadata and block unwanted cookies before they're stored
• activeTab — to read the current page's URL so per-domain rules can be applied
• tabs / webNavigation — to update the blocked-cookie badge counter as you navigate between pages
• storage — to save your preferences, custom rules, and blocked cookie log locally on your device
• scripting — to detect cookie-consent dialogs and click "reject" on your behalf (and inject fallback hiding styles) at page load time
• host_permissions (<all_urls>) — required to intercept cookies and act on consent banners across all websites you visit

No browsing history, page content, form data, or passwords are ever accessed.


WHO IT'S FOR

Cookie Jar is for anyone who wants a cleaner, more private browsing experience without giving up the convenience of staying logged in everywhere. It works quietly in the background — you don't need to think about it. If you want to dig deeper, the statistics panel and customize rules are there. If you just want to install it and forget about it, the defaults handle everything sensibly from day one.

No accounts. No subscriptions. No data collection. Just a cookie jar that keeps the right cookies in and the wrong ones out.

---

## Permission Justifications
*(paste into Developer Dashboard → "Privacy practices" → each permission's justification box; all are within the 1,000-character limit)*

**cookies**
The cookies permission is the core of this extension. It reads cookies set on each page the user visits, classifies them by category (necessary, session, authentication, functional, tracking, advertising, analytics, third-party, unknown), and removes the ones the user has configured to block. Real-time blocking also listens to cookies.onChanged so newly set cookies are evaluated and removed immediately.

**activeTab**
Used to read the URL of the currently active tab so the popup can display the cookies present on that page, show the per-tab blocked-cookie count in the toolbar badge, and apply per-domain custom rules the user has set.

**storage**
Stores user preferences (which cookie categories to block), custom rules (per-domain, overrides, blocked, name patterns, max-age limits), paused domains, and the blocked-cookie log used for the Statistics view — all locally in chrome.storage.local and chrome.storage.sync. No data is sent to any external server.

**tabs**
Used to read the active tab's URL (so the popup shows the right site's cookies), update the toolbar badge count when cookies are blocked on a tab, open the onboarding page after installation, and return the user to their previous tab from the full-page view.

**scripting**
Used by the extension's automatic consent-rejection feature. It calls chrome.scripting.executeScript with world:'MAIN' to run a small, fixed set of helper functions bundled inside the extension that read a page's consent JavaScript API (such as the IAB TCF __tcfapi) so a "reject" choice can be applied. These are predefined, bundled functions — no remote or dynamically fetched code is ever executed. It also calls chrome.scripting.insertCSS to inject fallback hiding styles for consent banners when auto-reject is off.

**webNavigation**
Listens to webNavigation.onCommitted to inject the fallback consent-banner hiding CSS at the earliest possible moment — before page content renders — so that when the auto-reject engine is disabled, banners are hidden without a visible flicker, and to apply the engine's per-site setting early in navigation.

**host permissions (&lt;all_urls&gt;)**
Required so the extension can read and remove cookies, and detect and automatically reject cookie-consent banners, on any website the user visits — not just a predetermined list. This must work across all pages. The extension never transmits any cookie data externally; all processing happens on-device.

**Are you using remote code?** — **No.** All logic ships inside the package: the consent engine's MAIN-world helpers are a fixed, bundled function registry and the consent rules are bundled JSON. Nothing is fetched from a remote source and executed.

