(()=>{var v=document.getElementById("app"),t={screen:"loading",network:"devnet",publicKey:null,error:"",pendingMnemonic:null,balance:null,transactions:[]};function i(e,n={}){return chrome.runtime.sendMessage({type:e,...n})}function p(e,n=4){return e?`${e.slice(0,n)}\u2026${e.slice(-n)}`:""}function c(){v.innerHTML="";let e=new URLSearchParams(location.search);if(e.get("mode")==="approve"){T(e);return}switch(t.screen){case"loading":return b();case"welcome":return y();case"create-password":return w();case"create-reveal":return m();case"import":return k();case"unlock":return h();case"home":return S();case"send":return g();case"receive":return f();case"settings":return x();case"reveal-seed":return q();default:return b()}}function l(e=""){let n=document.createElement("div");return n.className=`screen ${e}`.trim(),v.appendChild(n),n}function b(){let e=l("screen-center");e.innerHTML="<p>Loading\u2026</p>"}function y(){let e=l("screen-center");e.innerHTML=`
    <div class="stack" style="align-items:center; text-align:center;">
      <div class="eyebrow">Solana \xB7 Non-custodial</div>
      <h1>ZRP Wallet</h1>
      <p>Your keys stay on this device. ZRP never sees them.</p>
    </div>
    <div class="stack" style="width:100%; margin-top: 24px;">
      <button class="btn-primary" id="btn-create">Create a new wallet</button>
      <button class="btn-secondary" id="btn-import">I already have a wallet</button>
    </div>
  `,e.querySelector("#btn-create").onclick=()=>{t.screen="create-password",t.error="",c()},e.querySelector("#btn-import").onclick=()=>{t.screen="import",t.error="",c()}}function w(){let e=l();e.innerHTML=`
    <h1>Set a password</h1>
    <p>This unlocks ZRP Wallet on this device. It can't be recovered if you forget it \u2014 only your recovery phrase can restore the wallet.</p>
    <div class="stack">
      <input type="password" id="pw" placeholder="Password (min 8 characters)" class="mono" />
      <input type="password" id="pw2" placeholder="Confirm password" class="mono" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-continue">Continue</button>
    <button class="btn-ghost" id="btn-back">Back</button>
  `,e.querySelector("#btn-back").onclick=()=>{t.screen="welcome",c()},e.querySelector("#btn-continue").onclick=async()=>{let n=e.querySelector("#pw").value,r=e.querySelector("#pw2").value,s=e.querySelector("#err");if(n.length<8){s.textContent="Password must be at least 8 characters.";return}if(n!==r){s.textContent="Passwords don't match.";return}s.textContent="";let o=await i("CREATE_WALLET",{password:n});if(!o.ok){s.textContent=o.error||"Something went wrong.";return}t.pendingMnemonic=o.mnemonic,t.publicKey=o.publicKey,t.screen="create-reveal",c()}}function m(){let e=t.pendingMnemonic.split(" "),n=l();n.innerHTML=`
    <h1>Your recovery phrase</h1>
    <p>Write these 12 words down in order and keep them somewhere safe. Anyone with this phrase can access your wallet.</p>
    <div class="mnemonic-grid">
      ${e.map((o,a)=>`<div class="mnemonic-word"><span class="idx">${a+1}</span>${o}</div>`).join("")}
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="confirm-saved" />
      I've saved my recovery phrase somewhere safe.
    </label>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-done" disabled>Continue</button>
  `;let r=n.querySelector("#confirm-saved"),s=n.querySelector("#btn-done");r.onchange=()=>{s.disabled=!r.checked},s.onclick=()=>{t.pendingMnemonic=null,t.screen="home",c(),d()}}function k(){let e=l();e.innerHTML=`
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
  `,e.querySelector("#btn-back").onclick=()=>{t.screen="welcome",c()},e.querySelector("#btn-import").onclick=async()=>{let n=e.querySelector("#mnemonic").value,r=e.querySelector("#pw").value,s=e.querySelector("#pw2").value,o=e.querySelector("#err");if(r.length<8){o.textContent="Password must be at least 8 characters.";return}if(r!==s){o.textContent="Passwords don't match.";return}o.textContent="";let a=await i("IMPORT_WALLET",{mnemonic:n,password:r});if(!a.ok){o.textContent=a.error||"Something went wrong.";return}t.publicKey=a.publicKey,t.screen="home",c(),d()}}function h(){let e=l();e.innerHTML=`
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
  `;let n=e.querySelector("#pw"),r=async()=>{let s=e.querySelector("#err"),o=await i("UNLOCK",{password:n.value});if(!o.ok){s.textContent=o.error||"Incorrect password.";return}t.publicKey=o.publicKey,t.screen="home",c(),d()};e.querySelector("#btn-unlock").onclick=r,n.onkeydown=s=>{s.key==="Enter"&&r()}}async function d(){let[e,n,r]=await Promise.all([i("GET_BALANCE"),i("GET_TRANSACTIONS"),i("GET_STATE")]);e.ok&&(t.balance=e.sol),n.ok&&(t.transactions=n.transactions),r.ok&&(t.network=r.network),t.screen==="home"&&c()}function S(){let e=l(),n=t.balance===null?"\u2014":t.balance.toFixed(4);e.innerHTML=`
    <div class="row-between">
      <div class="network-badge"><span class="signal-dot"></span>${t.network}</div>
      <button class="btn-ghost" id="btn-settings">\u2699</button>
    </div>

    <div class="stack" style="align-items:center; text-align:center; margin: 8px 0;">
      <div class="eyebrow">${p(t.publicKey)}</div>
      <div><span class="balance">${n}</span><span class="balance-unit">SOL</span></div>
    </div>

    <div class="row" style="justify-content:center; gap: 16px;">
      <div class="stack" style="align-items:center; gap:6px;">
        <button class="btn-icon" id="btn-send">\u2191<span></span>Send</button>
      </div>
      <div class="stack" style="align-items:center; gap:6px;">
        <button class="btn-icon" id="btn-receive">\u2193<span></span>Receive</button>
      </div>
    </div>

    <h2 style="margin-top: 8px;">Recent activity</h2>
    <div class="tx-list" id="tx-list"></div>
  `;let r=e.querySelector("#tx-list");t.transactions.length===0?r.innerHTML='<div class="empty-state">No transactions yet.</div>':r.innerHTML=t.transactions.map(s=>`
        <div class="tx-row">
          <span class="tx-sig">${p(s.signature,6)}</span>
          <span class="${s.err?"tx-status-err":"tx-status-ok"}">${s.err?"Failed":"Confirmed"}</span>
        </div>`).join(""),e.querySelector("#btn-settings").onclick=()=>{t.screen="settings",c()},e.querySelector("#btn-send").onclick=()=>{t.error="",t.screen="send",c()},e.querySelector("#btn-receive").onclick=()=>{t.screen="receive",c()}}function g(){let e=l();e.innerHTML=`
    <h1>Send SOL</h1>
    <div class="stack">
      <input type="text" id="to" placeholder="Recipient address" class="mono" />
      <input type="number" id="amount" placeholder="Amount (SOL)" step="0.0001" min="0" />
      <div class="error-text" id="err"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn-primary" id="btn-send">Send</button>
    <button class="btn-ghost" id="btn-back">Cancel</button>
  `,e.querySelector("#btn-back").onclick=()=>{t.screen="home",c()},e.querySelector("#btn-send").onclick=async n=>{let r=e.querySelector("#to").value.trim(),s=parseFloat(e.querySelector("#amount").value),o=e.querySelector("#err"),a=n.currentTarget;if(!r){o.textContent="Enter a recipient address.";return}if(!s||s<=0){o.textContent="Enter an amount greater than 0.";return}o.textContent="",a.disabled=!0,a.textContent="Sending\u2026";let u=await i("SEND_TRANSFER",{to:r,amountSol:s});if(a.disabled=!1,a.textContent="Send",!u.ok){o.textContent=u.error||"Transaction failed.";return}t.screen="home",c(),d()}}function f(){let e=l();e.innerHTML=`
    <h1>Receive SOL</h1>
    <p>Share this address to receive SOL and SPL tokens on ${t.network}.</p>
    <div class="address-box">${t.publicKey}</div>
    <button class="btn-secondary" id="btn-copy">Copy address</button>
    <div class="spacer"></div>
    <button class="btn-ghost" id="btn-back">Back</button>
  `,e.querySelector("#btn-copy").onclick=async n=>{await navigator.clipboard.writeText(t.publicKey);let r=n.currentTarget;r.textContent="Copied!",setTimeout(()=>r.textContent="Copy address",1200)},e.querySelector("#btn-back").onclick=()=>{t.screen="home",c()}}function x(){let e=l();e.innerHTML=`
    <h1>Settings</h1>
    <div class="stack">
      <div class="eyebrow">Network</div>
      <div class="row">
        <button class="${t.network==="devnet"?"btn-primary":"btn-secondary"}" id="btn-devnet" style="flex:1;">Devnet</button>
        <button class="${t.network==="mainnet-beta"?"btn-primary":"btn-secondary"}" id="btn-mainnet" style="flex:1;">Mainnet</button>
      </div>
    </div>
    <div class="stack" style="margin-top: 12px;">
      <button class="btn-secondary" id="btn-reveal">Reveal recovery phrase</button>
      <button class="btn-danger" id="btn-lock">Lock wallet</button>
    </div>
    <div class="spacer"></div>
    <button class="btn-ghost" id="btn-back">Back</button>
  `,e.querySelector("#btn-devnet").onclick=async()=>{await i("SET_NETWORK",{network:"devnet"}),t.network="devnet",c(),d()},e.querySelector("#btn-mainnet").onclick=async()=>{await i("SET_NETWORK",{network:"mainnet-beta"}),t.network="mainnet-beta",c(),d()},e.querySelector("#btn-reveal").onclick=()=>{t.screen="reveal-seed",c()},e.querySelector("#btn-lock").onclick=async()=>{await i("LOCK"),t.screen="unlock",c()},e.querySelector("#btn-back").onclick=()=>{t.screen="home",c()}}function q(){let e=l();e.innerHTML=`
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
  `,e.querySelector("#btn-back").onclick=()=>{t.screen="settings",c()},e.querySelector("#btn-show").onclick=async()=>{let n=e.querySelector("#pw").value,r=e.querySelector("#err"),s=await i("REVEAL_MNEMONIC",{password:n});if(!s.ok){r.textContent=s.error||"Incorrect password.";return}r.textContent="";let o=e.querySelector("#mnemonic-card");o.style.display="block",o.innerHTML=`<div class="mnemonic-grid">${s.mnemonic.split(" ").map((a,u)=>`<div class="mnemonic-word"><span class="idx">${u+1}</span>${a}</div>`).join("")}</div>`}}function T(e){let n=e.get("requestId"),r=e.get("origin"),s=e.get("kind"),o=l("screen-center"),a=s==="connect"?"Connection request":"Signature request",u=s==="connect"?"wants to view your wallet address and request approval for transactions.":"wants you to approve a transaction.";o.innerHTML=`
    <div class="stack" style="align-items:center; text-align:center;">
      <div class="eyebrow">${a}</div>
      <h1 style="word-break: break-all;">${r}</h1>
      <p>${u}</p>
    </div>
    <div class="stack" style="width:100%; margin-top:20px;">
      <button class="btn-primary" id="btn-approve">Approve</button>
      <button class="btn-secondary" id="btn-reject">Reject</button>
    </div>
  `,o.querySelector("#btn-approve").onclick=async()=>{await i("APPROVE_CONNECTION",{requestId:n}),window.close()},o.querySelector("#btn-reject").onclick=async()=>{await i("REJECT_CONNECTION",{requestId:n}),window.close()}}async function C(){if(new URLSearchParams(location.search).get("mode")==="approve"){c();return}let n=await i("GET_STATE");if(!n.ok&&n.hasWallet===void 0){t.screen="welcome",c();return}t.network=n.network,t.publicKey=n.publicKey,n.hasWallet?n.isUnlocked?t.screen="home":t.screen="unlock":t.screen="welcome",c(),t.screen==="home"&&d()}C();})();
