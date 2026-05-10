'use strict';

// Notify background when new cookies are set via document.cookie
// This is a lightweight observer — actual cookie reading happens in background.js
(function () {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (!originalDescriptor) return;

  let notifyTimeout = null;

  function scheduleNotify() {
    clearTimeout(notifyTimeout);
    notifyTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'APPLY_PREFS', url: location.href }).catch(() => {});
    }, 500);
  }

  Object.defineProperty(document, 'cookie', {
    get: originalDescriptor.get,
    set(val) {
      originalDescriptor.set.call(this, val);
      scheduleNotify();
    },
    configurable: true,
  });
})();
