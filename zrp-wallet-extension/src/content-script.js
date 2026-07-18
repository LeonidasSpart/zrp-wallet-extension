// Runs in an isolated world (has chrome.runtime access, but a separate JS
// context from the page). Relays messages between inject.js (page context)
// and the background service worker.

const BRIDGE_TAG = "zrp-wallet-bridge";

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.tag !== BRIDGE_TAG || data.direction !== "to-content") return;

  const { requestId, type, payload } = data;
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      origin: window.location.origin,
      ...payload,
    });
    window.postMessage(
      { tag: BRIDGE_TAG, direction: "to-page", requestId, response },
      window.location.origin
    );
  } catch (err) {
    window.postMessage(
      {
        tag: BRIDGE_TAG,
        direction: "to-page",
        requestId,
        response: { ok: false, error: err.message || String(err) },
      },
      window.location.origin
    );
  }
});
