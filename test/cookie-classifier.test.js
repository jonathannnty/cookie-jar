import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// cookie-classifier.js is a classic script exposing a global `const CookieClassifier`.
// Load it into a vm sandbox and lift that binding onto the sandbox global.
const src = readFileSync(new URL('../utils/cookie-classifier.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.CookieClassifier = CookieClassifier;', sandbox);
const { CookieClassifier } = sandbox;

// Consent-state / privacy-record cookies that must be classified `necessary`
// so the deletion routine never removes them (removing them re-shows the banner).
const CONSENT_COOKIES = [
  'OptanonConsent', 'OptanonAlertBoxClosed',   // OneTrust
  'CookieConsent',                              // Cookiebot
  'euconsent-v2', 'euconsent',                  // IAB TCF
  'didomi_token', 'didomi_dcs',                 // Didomi
  'addtl_consent',                              // Google Additional Consent
  'CONSENT',                                    // Google
  'cmapi_cookie_privacy', 'notice_gdpr_prefs',  // TrustArc
  'usprivacy',                                  // US Privacy
];

for (const name of CONSENT_COOKIES) {
  test(`consent cookie "${name}" classifies as necessary`, () => {
    const { category } = CookieClassifier.classifyCookie(
      { name, domain: 'example.com', expirationDate: Date.now() / 1000 + 86400 },
      'example.com',
    );
    assert.equal(category, 'necessary', `${name} -> ${category} (expected 'necessary')`);
  });
}
