# ZRP Wallet — Browser Extension

A non-custodial Solana wallet browser extension (Manifest V3). Generates and holds keys entirely on-device — nothing is ever sent to a server.

**Status: MVP.** This is a working first version, not a production-hardened wallet. See "Known limitations" below before using it with real funds.

## Features (MVP)

- Create a new wallet (BIP39 mnemonic, standard Solana derivation path — compatible with Phantom/Solflare address derivation)
- Import an existing wallet from a recovery phrase
- Password-protected local vault (AES-GCM, PBKDF2 250k iterations)
- View SOL balance and recent transaction history
- Send SOL
- Basic dApp connection support — sites can request to connect via `window.zrp` and request transaction signatures, with an approval popup
- Devnet / Mainnet toggle

## Architecture

- `src/background.js` — the service worker. Holds the decrypted mnemonic in `chrome.storage.session` (not disk) while unlocked, times out after 15 minutes idle, handles all wallet operations and RPC calls.
- `src/popup/` — the UI shown when you click the extension icon, and also reused as a separate approval popup window for dApp connection/signing requests.
- `src/content-script.js` + `src/inject.js` — the bridge that lets websites detect and talk to the wallet via `window.zrp`, without directly exposing extension APIs to untrusted page code.
- `src/lib/keys.js` — mnemonic generation and Solana key derivation (`m/44'/501'/0'/0'`, the same path Phantom/Solflare use).
- `src/lib/vault.js` — WebCrypto AES-GCM encryption for the mnemonic at rest.

## Build

Dependencies (`@solana/web3.js`, `bip39`, `ed25519-hd-key`) are fetched and bundled via GitHub Actions since local network access may not be available:

1. Push this repo to GitHub
2. Go to **Actions → Build Extension → Run workflow**
3. This runs `npm install`, bundles everything with esbuild into `dist/`, and commits the built files back to the repo

If the build fails with a "could not resolve" error for a Node built-in module (e.g. `crypto`, `stream`), a dependency needs an additional browser polyfill — add the corresponding polyfill package (e.g. `crypto-browserify`) to `package.json` and alias it in `build.js`, following the same pattern used for the existing `buffer` polyfill in `src/lib/buffer-polyfill.js`.

## Local testing (load unpacked)

1. Open `chrome://extensions` (or the equivalent in Brave/Edge)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**, select the repo folder (the one containing `manifest.json`)
4. The ZRP Wallet icon appears in your toolbar

Since this uses Devnet by default, get free test SOL from the [Solana faucet](https://faucet.solana.com) to try sending/receiving without real funds.

## Known limitations (read before real use)

- **Not audited.** This is an MVP built quickly — do not use with meaningful amounts of real funds until it's been properly security-reviewed.
- **dApp provider is minimal.** It implements basic connect/sign, not the full [Solana Wallet Standard](https://github.com/wallet-standard/wallet-standard) spec, so some dApps built against `wallet-adapter` may not detect it yet. Full Wallet Standard registration is a good next step.
- **No SPL token support yet** — only native SOL. Token balances/transfers are a common next feature.
- **Icons are placeholders** — swap `icons/icon16.png`, `icon48.png`, `icon128.png` for real artwork before any public release.
- **Auto-lock relies on `chrome.storage.session`**, which is cleared on browser close (by design) and on the 15-minute idle timer. If Chrome terminates the service worker for other reasons, you may be prompted to unlock again sooner than 15 minutes — this is expected MV3 behavior, not a bug.
- **No Chrome Web Store packaging yet.** Publishing requires a developer account, listing assets, and passing Google's review — a separate step from getting the extension working locally.

## Security notes

- The mnemonic is encrypted at rest with a password-derived AES-GCM key (PBKDF2, 250,000 iterations, SHA-256). Wrong password = decryption fails outright (authenticated encryption), it doesn't "partially" decrypt.
- The decrypted mnemonic only ever lives in `chrome.storage.session`, which is memory-backed and never written to disk, and is cleared on lock/timeout/browser close.
- No private key or mnemonic is ever sent over the network, to this extension's own infrastructure or anyone else's.
