'use strict';

// Global namespace for MV3 compatibility (importScripts / <script src>)
const CookiePrefs = (() => {
  const DEFAULT_PREFS = {
    mode: 'simple',
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
    autoConsent: {
      enabled: true,
      action:  'optOut', // 'optOut' rejects; 'optIn' accepts (advanced)
    },
  };

  function mergePrefs(saved) {
    return Object.assign({}, DEFAULT_PREFS, saved, {
      categories:  Object.assign({}, DEFAULT_PREFS.categories, saved?.categories),
      simple:      Object.assign({}, DEFAULT_PREFS.simple,     saved?.simple),
      autoConsent: Object.assign({}, DEFAULT_PREFS.autoConsent, saved?.autoConsent),
    });
  }

  return { DEFAULT_PREFS, mergePrefs };
})();
