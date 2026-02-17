// AllTab background.js v2
// Handles extension lifecycle events

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open a welcome/info page on first install (optional)
    console.log('AllTab installed');
  }
});

// Keep service worker alive if needed
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.ping) respond({ pong: true });
  return true;
});
