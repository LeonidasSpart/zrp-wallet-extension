const app = document.getElementById("app");

const state = {
  screen: "loading",
  network: "devnet",
  publicKey: null,
  error: "",
  pendingMnemonic: null, // held only in memory during the create-wallet flow
  balance: null,
  tokens: [],
  transactions: [],
  selectedAsset: "SOL", // "SOL" or a mint address, set when Send is opened from a specific asset row
};

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function short(address, chars = 4) {
  if (!address) return "";
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

// Token names/symbols come from arbitrary on-chain data set by whoever
// minted the token — never trust it as safe HTML.
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  app.innerHTML = "";
  const params = new URLSearchParams(location.search);

  if (params.get("mode") === "approve") {
    renderApprove(params);
    return;
  }

  switch (state.screen) {
    case "loading":
      return renderLoading();
    case "welcome":
      return renderWelcome();
    case "create-password":
      return renderCreatePassword();
    case "create-reveal":
      return renderCreateReveal();
    case "import":
      return renderImport();
    case "unlock":
      return renderUnlock();
    case "home":
      return renderHome();
    case "send":
      return renderSend();
    case "receive":
      return renderReceive();
    case "settings":
      return renderSettings();
    case "reveal-seed":
      return renderRevealSeed();
    default:
      return renderLoading();
  }
}

function screenEl(className = "") {
  const div = document.createElement("div");
  div.className = `screen ${className}`.trim();
  app.appendChild(div);
  return div;
}

// ---------- loading / welcome ----------

function renderLoading() {
  const el = screenEl("screen-center");
  el.innerHTML = `<p>Loading…</p>`;
}

function renderWelcome() {
  const el = screenEl("screen-center");
  el.innerHTML = `
    <div class="stack" style="align-items:center; text-align:center;">
      <div class="eyebrow">Solana · Non-custodial</div>
      <h1>ZRP Wallet</h1>
      <p>Your keys stay on this device. ZRP never sees them.</p>
    </div>
    <div class="stack" style="width:100%; margin-top: 24px;">
      <button class="btn-primary" id="btn-create">Create a new wallet</button>
      <button class="btn-secondary" id="btn-import">I already have a wallet</button>
    </div>
  `;
  el.querySelector("#btn-create").onclick = () => {
    state.screen = "create-password";
    state.error = "";
    render();
  };
  el.querySelector("#btn-import").onclick = () => {
    state.screen = "import";
    state.error = "";
    render();
  };
}

// ---------- create wallet ----------

function renderCreatePassword() {
  const el = screenEl();
  el.innerHTML = `
    <h1>Set a password</h1>
    <p>This unlocks ZRP Wallet on this device. It can't be recovered if you forget it — only your recovery phrase can restore the wallet.</p>
    <div class="stack">
      <input type="password" id="pw" placeholder="Password (min 8 characters)" class="mono" />
      <input type="password" id="pw2" placeholder="Confirm password" class="mono" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-continue">Continue</button>
    <button class="btn-ghost" id="btn-back">Back</button>
  `;
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "welcome";
    render();
  };
  el.querySelector("#btn-continue").onclick = async () => {
    const pw = el.querySelector("#pw").value;
    const pw2 = el.querySelector("#pw2").value;
    const errEl = el.querySelector("#err");
    if (pw.length < 8) {
      errEl.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (pw !== pw2) {
      errEl.textContent = "Passwords don't match.";
      return;
    }
    errEl.textContent = "";
    const res = await send("CREATE_WALLET", { password: pw });
    if (!res.ok) {
      errEl.textContent = res.error || "Something went wrong.";
      return;
    }
    state.pendingMnemonic = res.mnemonic;
    state.publicKey = res.publicKey;
    state.screen = "create-reveal";
    render();
  };
}

function renderCreateReveal() {
  const words = state.pendingMnemonic.split(" ");
  const el = screenEl();
  el.innerHTML = `
    <h1>Your recovery phrase</h1>
    <p>Write these 12 words down in order and keep them somewhere safe. Anyone with this phrase can access your wallet.</p>
    <div class="mnemonic-grid">
      ${words
        .map(
          (w, i) =>
            `<div class="mnemonic-word"><span class="idx">${i + 1}</span>${w}</div>`
        )
        .join("")}
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="confirm-saved" />
      I've saved my recovery phrase somewhere safe.
    </label>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-done" disabled>Continue</button>
  `;
  const checkbox = el.querySelector("#confirm-saved");
  const doneBtn = el.querySelector("#btn-done");
  checkbox.onchange = () => {
    doneBtn.disabled = !checkbox.checked;
  };
  doneBtn.onclick = () => {
    state.pendingMnemonic = null;
    state.screen = "home";
    render();
    loadHomeData();
  };
}

// ---------- import wallet ----------

function renderImport() {
  const el = screenEl();
  el.innerHTML = `
    <h1>Import wallet</h1>
    <p>Enter your 12 or 24-word recovery phrase, separated by spaces.</p>
    <div class="stack">
      <textarea id="mnemonic" class="mono" placeholder="word1 word2 word3 ..."></textarea>
      <input type="password" id="pw" placeholder="Set a password for this device" class="mono" />
      <input type="password" id="pw2" placeholder="Confirm password" class="mono" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-import">Import wallet</button>
    <button class="btn-ghost" id="btn-back">Back</button>
  `;
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "welcome";
    render();
  };
  el.querySelector("#btn-import").onclick = async () => {
    const mnemonic = el.querySelector("#mnemonic").value;
    const pw = el.querySelector("#pw").value;
    const pw2 = el.querySelector("#pw2").value;
    const errEl = el.querySelector("#err");
    if (pw.length < 8) {
      errEl.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (pw !== pw2) {
      errEl.textContent = "Passwords don't match.";
      return;
    }
    errEl.textContent = "";
    const res = await send("IMPORT_WALLET", { mnemonic, password: pw });
    if (!res.ok) {
      errEl.textContent = res.error || "Something went wrong.";
      return;
    }
    state.publicKey = res.publicKey;
    state.screen = "home";
    render();
    loadHomeData();
  };
}

// ---------- unlock ----------

function renderUnlock() {
  const el = screenEl();
  el.innerHTML = `
    <div class="stack" style="margin-top: 40px;">
      <div class="eyebrow">ZRP Wallet</div>
      <h1>Enter your password</h1>
    </div>
    <div class="stack">
      <input type="password" id="pw" placeholder="Password" class="mono" autofocus />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-unlock">Unlock</button>
  `;
  const pwInput = el.querySelector("#pw");
  const doUnlock = async () => {
    const errEl = el.querySelector("#err");
    const res = await send("UNLOCK", { password: pwInput.value });
    if (!res.ok) {
      errEl.textContent = res.error || "Incorrect password.";
      return;
    }
    state.publicKey = res.publicKey;
    state.screen = "home";
    render();
    loadHomeData();
  };
  el.querySelector("#btn-unlock").onclick = doUnlock;
  pwInput.onkeydown = (e) => {
    if (e.key === "Enter") doUnlock();
  };
}

// ---------- home ----------

async function loadHomeData() {
  const [balanceRes, tokensRes, txRes, stateRes] = await Promise.all([
    send("GET_BALANCE"),
    send("GET_TOKEN_BALANCES"),
    send("GET_TRANSACTIONS"),
    send("GET_STATE"),
  ]);
  if (balanceRes.ok) state.balance = balanceRes.sol;
  if (tokensRes.ok) state.tokens = tokensRes.tokens;
  if (txRes.ok) state.transactions = txRes.transactions;
  if (stateRes.ok) state.network = stateRes.network;
  if (state.screen === "home") render();
}

function renderHome() {
  const el = screenEl();
  const balanceText = state.balance === null ? "—" : state.balance.toFixed(4);

  el.innerHTML = `
    <div class="row-between">
      <div class="network-badge"><span class="signal-dot"></span>${state.network}</div>
      <button class="btn-ghost" id="btn-settings">⚙</button>
    </div>

    <div class="stack" style="align-items:center; text-align:center; margin: 8px 0;">
      <div class="eyebrow">${short(state.publicKey)}</div>
      <div><span class="balance">${balanceText}</span><span class="balance-unit">SOL</span></div>
    </div>

    <div class="row" style="justify-content:center; gap: 16px;">
      <div class="stack" style="align-items:center; gap:6px;">
        <button class="btn-icon" id="btn-send">↑<span></span>Send</button>
      </div>
      <div class="stack" style="align-items:center; gap:6px;">
        <button class="btn-icon" id="btn-receive">↓<span></span>Receive</button>
      </div>
    </div>

    <h2 style="margin-top: 8px;">Tokens</h2>
    <div class="tx-list" id="token-list"></div>

    <h2 style="margin-top: 8px;">Recent activity</h2>
    <div class="tx-list" id="tx-list"></div>
  `;

  const tokenList = el.querySelector("#token-list");
  if (state.tokens.length === 0) {
    tokenList.innerHTML = `<div class="empty-state">No other tokens yet.</div>`;
  } else {
    tokenList.innerHTML = state.tokens
      .map((t) => {
        const label = t.symbol
          ? escapeHtml(t.symbol)
          : t.name
          ? escapeHtml(t.name)
          : short(t.mint, 5);
        const iconHtml = t.image
          ? `<img class="token-icon" src="${escapeHtml(t.image)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'token-icon token-icon-fallback'}))" />`
          : `<div class="token-icon token-icon-fallback"></div>`;
        return `
        <div class="tx-row token-row" data-mint="${t.mint}">
          <div class="row" style="gap:10px;">
            ${iconHtml}
            <span class="eyebrow" style="color: var(--text);">${label}</span>
          </div>
          <span class="tx-sig">${t.amount}</span>
        </div>`;
      })
      .join("");
    tokenList.querySelectorAll(".token-row").forEach((row) => {
      row.onclick = () => {
        state.selectedAsset = row.dataset.mint;
        state.error = "";
        state.screen = "send";
        render();
      };
    });
  }

  const txList = el.querySelector("#tx-list");
  if (state.transactions.length === 0) {
    txList.innerHTML = `<div class="empty-state">No transactions yet.</div>`;
  } else {
    txList.innerHTML = state.transactions
      .map(
        (tx) => `
        <div class="tx-row">
          <span class="tx-sig">${short(tx.signature, 6)}</span>
          <span class="${tx.err ? "tx-status-err" : "tx-status-ok"}">${tx.err ? "Failed" : "Confirmed"}</span>
        </div>`
      )
      .join("");
  }

  el.querySelector("#btn-settings").onclick = () => {
    state.screen = "settings";
    render();
  };
  el.querySelector("#btn-send").onclick = () => {
    state.error = "";
    state.selectedAsset = "SOL";
    state.screen = "send";
    render();
  };
  el.querySelector("#btn-receive").onclick = () => {
    state.screen = "receive";
    render();
  };
}

// ---------- send ----------

function renderSend() {
  const isToken = state.selectedAsset !== "SOL";
  const token = isToken ? state.tokens.find((t) => t.mint === state.selectedAsset) : null;
  const assetLabel = isToken
    ? escapeHtml(token?.symbol || token?.name || short(state.selectedAsset, 5))
    : "SOL";

  const el = screenEl();
  el.innerHTML = `
    <h1>Send ${assetLabel}</h1>
    ${
      isToken
        ? `<p>Balance: ${token ? token.amount : "—"}</p>`
        : ""
    }
    <div class="stack">
      <input type="text" id="to" placeholder="Recipient address" class="mono" />
      <input type="number" id="amount" placeholder="Amount${isToken ? "" : " (SOL)"}" step="any" min="0" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-send">Send</button>
    <button class="btn-ghost" id="btn-back">Cancel</button>
  `;
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "home";
    render();
  };
  el.querySelector("#btn-send").onclick = async (e) => {
    const to = el.querySelector("#to").value.trim();
    const amount = parseFloat(el.querySelector("#amount").value);
    const errEl = el.querySelector("#err");
    const btn = e.currentTarget;

    if (!to) {
      errEl.textContent = "Enter a recipient address.";
      return;
    }
    if (!amount || amount <= 0) {
      errEl.textContent = "Enter an amount greater than 0.";
      return;
    }
    errEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Sending…";

    let res;
    if (isToken) {
      if (!token) {
        errEl.textContent = "Couldn't find that token's balance. Go back and try again.";
        btn.disabled = false;
        btn.textContent = "Send";
        return;
      }
      const rawAmount = BigInt(Math.round(amount * 10 ** token.decimals));
      res = await send("SEND_TOKEN_TRANSFER", {
        to,
        mint: state.selectedAsset,
        rawAmount: rawAmount.toString(),
      });
    } else {
      res = await send("SEND_TRANSFER", { to, amountSol: amount });
    }

    btn.disabled = false;
    btn.textContent = "Send";

    if (!res.ok) {
      errEl.textContent = res.error || "Transaction failed.";
      return;
    }
    state.selectedAsset = "SOL";
    state.screen = "home";
    render();
    loadHomeData();
  };
}

// ---------- receive ----------

function renderReceive() {
  const el = screenEl();
  el.innerHTML = `
    <h1>Receive SOL</h1>
    <p>Share this address to receive SOL and SPL tokens on ${state.network}.</p>
    <div class="address-box">${state.publicKey}</div>
    <button class="btn-secondary" id="btn-copy">Copy address</button>
    <div class="spacer"></div>
    <button class="btn-ghost" id="btn-back">Back</button>
  `;
  el.querySelector("#btn-copy").onclick = async (e) => {
    await navigator.clipboard.writeText(state.publicKey);
    const btn = e.currentTarget;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy address"), 1200);
  };
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "home";
    render();
  };
}

// ---------- settings ----------

function renderSettings() {
  const el = screenEl();
  el.innerHTML = `
    <h1>Settings</h1>
    <div class="stack">
      <div class="eyebrow">Network</div>
      <div class="row">
        <button class="${state.network === "devnet" ? "btn-primary" : "btn-secondary"}" id="btn-devnet" style="flex:1;">Devnet</button>
        <button class="${state.network === "mainnet-beta" ? "btn-primary" : "btn-secondary"}" id="btn-mainnet" style="flex:1;">Mainnet</button>
      </div>
    </div>
    <div class="stack" style="margin-top: 12px;">
      <button class="btn-secondary" id="btn-reveal">Reveal recovery phrase</button>
      <button class="btn-danger" id="btn-lock">Lock wallet</button>
    </div>
    <div class="spacer"></div>
    <button class="btn-ghost" id="btn-back">Back</button>
  `;
  el.querySelector("#btn-devnet").onclick = async () => {
    await send("SET_NETWORK", { network: "devnet" });
    state.network = "devnet";
    render();
    loadHomeData();
  };
  el.querySelector("#btn-mainnet").onclick = async () => {
    await send("SET_NETWORK", { network: "mainnet-beta" });
    state.network = "mainnet-beta";
    render();
    loadHomeData();
  };
  el.querySelector("#btn-reveal").onclick = () => {
    state.screen = "reveal-seed";
    render();
  };
  el.querySelector("#btn-lock").onclick = async () => {
    await send("LOCK");
    state.screen = "unlock";
    render();
  };
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "home";
    render();
  };
}

function renderRevealSeed() {
  const el = screenEl();
  el.innerHTML = `
    <h1>Reveal recovery phrase</h1>
    <p>Enter your password to reveal it. Never share this with anyone.</p>
    <div class="stack">
      <input type="password" id="pw" placeholder="Password" class="mono" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="card" id="mnemonic-card" style="display:none;"></div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-show">Show phrase</button>
    <button class="btn-ghost" id="btn-back">Back</button>
  `;
  el.querySelector("#btn-back").onclick = () => {
    state.screen = "settings";
    render();
  };
  el.querySelector("#btn-show").onclick = async () => {
    const pw = el.querySelector("#pw").value;
    const errEl = el.querySelector("#err");
    const res = await send("REVEAL_MNEMONIC", { password: pw });
    if (!res.ok) {
      errEl.textContent = res.error || "Incorrect password.";
      return;
    }
    errEl.textContent = "";
    const card = el.querySelector("#mnemonic-card");
    card.style.display = "block";
    card.innerHTML = `<div class="mnemonic-grid">${res.mnemonic
      .split(" ")
      .map((w, i) => `<div class="mnemonic-word"><span class="idx">${i + 1}</span>${w}</div>`)
      .join("")}</div>`;
  };
}

// ---------- dApp connection approval (separate popup window) ----------

function renderApprove(params) {
  const requestId = params.get("requestId");
  const origin = params.get("origin");
  const kind = params.get("kind");

  const el = screenEl("screen-center");
  const title = kind === "connect" ? "Connection request" : "Signature request";
  const body =
    kind === "connect"
      ? `wants to view your wallet address and request approval for transactions.`
      : `wants you to approve a transaction.`;

  el.innerHTML = `
    <div class="stack" style="align-items:center; text-align:center;">
      <div class="eyebrow">${title}</div>
      <h1 style="word-break: break-all;">${origin}</h1>
      <p>${body}</p>
    </div>
    <div class="stack" style="width:100%; margin-top:20px;">
      <button class="btn-primary" id="btn-approve">Approve</button>
      <button class="btn-secondary" id="btn-reject">Reject</button>
    </div>
  `;

  el.querySelector("#btn-approve").onclick = async () => {
    await send("APPROVE_CONNECTION", { requestId });
    window.close();
  };
  el.querySelector("#btn-reject").onclick = async () => {
    await send("REJECT_CONNECTION", { requestId });
    window.close();
  };
}

// ---------- boot ----------

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "approve") {
    render();
    return;
  }

  const res = await send("GET_STATE");
  if (!res.ok && res.hasWallet === undefined) {
    state.screen = "welcome";
    render();
    return;
  }

  state.network = res.network;
  state.publicKey = res.publicKey;

  if (!res.hasWallet) {
    state.screen = "welcome";
  } else if (!res.isUnlocked) {
    state.screen = "unlock";
  } else {
    state.screen = "home";
  }
  render();
  if (state.screen === "home") loadHomeData();
}

boot();
