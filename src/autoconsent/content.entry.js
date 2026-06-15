// Isolated-world content script. Instantiated with only a sendMessage callback;
// rules + config arrive from the background via the 'initResp' message.
import AutoConsent from '@duckduckgo/autoconsent/extra';

const consent = new AutoConsent(
  (message) => { chrome.runtime.sendMessage(message).catch(() => {}); },
  null, // config comes from background initResp
  null, // rules come from background initResp
);

chrome.runtime.onMessage.addListener((message) =>
  Promise.resolve(consent.receiveMessageCallback(message)),
);

// Lets the background detect frame teardown (matches the reference addon).
chrome.runtime.connect({ name: `instance-${consent.id}` });
