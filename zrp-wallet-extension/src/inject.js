// Runs in the page's main world. Exposes a minimal wallet provider so
// dApps can detect and interact with ZRP Wallet, plus registers with the
// Solana Wallet Standard so wallet-adapter-based dApps can discover it
// without name collisions against other installed wallets.

const BRIDGE_TAG = "zrp-wallet-bridge";
const pending = new Map();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.tag !== BRIDGE_TAG || data.direction !== "to-page") return;

  const entry = pending.get(data.requestId);
  if (!entry) return;
  pending.delete(data.requestId);
  entry.resolve(data.response);
});

function callBackground(type, payload = {}) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    pending.set(requestId, { resolve });
    window.postMessage(
      { tag: BRIDGE_TAG, direction: "to-content", requestId, type, payload },
      window.location.origin
    );
  });
}

class ZrpWalletProvider extends EventTarget {
  constructor() {
    super();
    this.isZrpWallet = true;
    this.publicKey = null;
  }

  async connect() {
    const res = await callBackground("DAPP_CONNECT");
    if (!res.ok) throw new Error(res.error);
    this.publicKey = res.publicKey;
    this.dispatchEvent(new CustomEvent("connect", { detail: res.publicKey }));
    return { publicKey: res.publicKey };
  }

  async signTransaction(transactionBase64) {
    const res = await callBackground("DAPP_SIGN_TRANSACTION", { transactionBase64 });
    if (!res.ok) throw new Error(res.error);
    return res.signedTransactionBase64;
  }

  disconnect() {
    this.publicKey = null;
    this.dispatchEvent(new CustomEvent("disconnect"));
  }
}

window.zrp = new ZrpWalletProvider();
