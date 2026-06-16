import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../utils/prefs.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.CookiePrefs = CookiePrefs;', sandbox);
const { CookiePrefs } = sandbox;

test('DEFAULT_PREFS enables auto-consent', () => {
  assert.equal(CookiePrefs.DEFAULT_PREFS.autoConsent.enabled, true);
});

test('mergePrefs backfills autoConsent for old saved prefs', () => {
  const merged = CookiePrefs.mergePrefs({ mode: 'advanced' }); // saved prefs without autoConsent
  assert.equal(merged.autoConsent.enabled, true);
  assert.equal(merged.mode, 'advanced'); // saved value preserved
});

test('mergePrefs preserves a user-disabled autoConsent', () => {
  const merged = CookiePrefs.mergePrefs({ autoConsent: { enabled: false } });
  assert.equal(merged.autoConsent.enabled, false);
});
