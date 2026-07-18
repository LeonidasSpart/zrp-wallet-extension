import "./lib/buffer-polyfill.js";
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { generateMnemonic, isValidMnemonic, keypairFromMnemonic } from "./lib/keys.js";
import { encryptVault, decryptVault } from "./lib/vault.js";
import { storageGet, storageSet, storageRemove, STORAGE_KEYS } from "./lib/storage.js";
import { getConnection } from "./lib/rpc.js";

const SESSION_KEY_MNEMONIC = "zrp_session_mnemonic";
const SESSION_KEY_APPROVED_ORIGINS = "zrp_approved_origins";
const AUTO_LOCK_ALARM = "zrp_auto_lock";
const AUTO_LOCK_MINUTES = 15;

// requestId -> { resolve, reject } for pending dApp approval popups
const pendingApprovals = new Map();

// ---------- session helpers ----------

async function getSessionMnemonic() {
  const result = await chrome.storage.session.get(SESSION_KEY_MNEMONIC);
  return result[SESSION_KEY_MNEMONIC] || null;
}

async function setSessionMnemonic(mnemonic) {
  await chrome.storage.session.set({ [SESSION_KEY_MNEMONIC]: mnemonic });
  chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: AUTO_LOCK_MINUTES });
}

async function clearSession() {
  await chrome.storage.session.remove([SESSION_KEY_MNEMONIC, SESSION_KEY_APPROVED_ORIGINS]);
  chrome.alarms.clear(AUTO_LOCK_ALARM);
}

async function getApprovedOrigins() {
  const result = await chrome.storage.session.get(SESSION_KEY_APPROVED_ORIGINS);
  return result[SESSION_KEY_APPROVED_ORIGINS] || [];
}

async function addApprovedOrigin(origin) {
  const origins = await getApprovedOrigins();
  if (!origins.includes(origin)) {
    origins.push(origin);
    await chrome.storage.session.set({ [SESSION_KEY_APPROVED_ORIGINS]: origins });
  }
}

async function getActiveKeypair() {
  const mnemonic = await getSessionMnemonic();
  if (!mnemonic) return null;
  return keypairFromMnemonic(mnemonic);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) clearSession();
});

// ---------- popup-facing handlers ----------

async function handleGetState() {
  const { [STORAGE_KEYS.VAULT]: vault, [STORAGE_KEYS.NETWORK]: network } = await storageGet([
    STORAGE_KEYS.VAULT,
    STORAGE_KEYS.NETWORK,
  ]);
  const keypair = await getActiveKeypair();
  return {
    hasWallet: !!vault,
    isUnlocked: !!keypair,
    publicKey: keypair ? keypair.publicKey.toBase58() : null,
    network: network || "devnet",
  };
}

async function handleCreateWallet({ password }) {
  const mnemonic = generateMnemonic();
  const vault = await encryptVault(mnemonic, password);
  await storageSet({ [STORAGE_KEYS.VAULT]: vault });
  await setSessionMnemonic(mnemonic);
  const keypair = keypairFromMnemonic(mnemonic);
  return { ok: true, publicKey: keypair.publicKey.toBase58(), mnemonic };
}

async function handleImportWallet({ mnemonic, password }) {
  const trimmed = mnemonic.trim();
  if (!isValidMnemonic(trimmed)) {
    return { ok: false, error: "That recovery phrase doesn't look valid. Check the words and try again." };
  }
  const vault = await encryptVault(trimmed, password);
  await storageSet({ [STORAGE_KEYS.VAULT]: vault });
  await setSessionMnemonic(trimmed);
  const keypair = keypairFromMnemonic(trimmed);
  return { ok: true, publicKey: keypair.publicKey.toBase58() };
}

async function handleUnlock({ password }) {
  const { [STORAGE_KEYS.VAULT]: vault } = await storageGet(STORAGE_KEYS.VAULT);
  if (!vault) return { ok: false, error: "No wallet found on this device." };
  try {
    const mnemonic = await decryptVault(vault, password);
    await setSessionMnemonic(mnemonic);
    const keypair = keypairFromMnemonic(mnemonic);
    return { ok: true, publicKey: keypair.publicKey.toBase58() };
  } catch {
    return { ok: false, error: "Incorrect password." };
  }
}

async function handleLock() {
  await clearSession();
  return { ok: true };
}

async function handleGetBalance() {
  const keypair = await getActiveKeypair();
  if (!keypair) return { ok: false, error: "Wallet is locked." };
  const { [STORAGE_KEYS.NETWORK]: network } = await storageGet(STORAGE_KEYS.NETWORK);
  const connection = getConnection(network || "devnet");
  const lamports = await connection.getBalance(keypair.publicKey);
  return { ok: true, lamports, sol: lamports / LAMPORTS_PER_SOL };
}

async function handleGetTransactions() {
  const keypair = await getActiveKeypair();
  if (!keypair) return { ok: false, error: "Wallet is locked." };
  const { [STORAGE_KEYS.NETWORK]: network } = await storageGet(STORAGE_KEYS.NETWORK);
  const connection = getConnection(network || "devnet");
  const signatures = await connection.getSignaturesForAddress(keypair.publicKey, { limit: 15 });
  return {
    ok: true,
    transactions: signatures.map((s) => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime,
      err: s.err,
    })),
  };
}

async function handleSendTransfer({ to, amountSol }) {
  const keypair = await getActiveKeypair();
  if (!keypair) return { ok: false, error: "Wallet is locked." };

  let toPubkey;
  try {
    toPubkey = new PublicKey(to);
  } catch {
    return { ok: false, error: "That doesn't look like a valid Solana address." };
  }

  const { [STORAGE_KEYS.NETWORK]: network } = await storageGet(STORAGE_KEYS.NETWORK);
  const connection = getConnection(network || "devnet");

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    })
  );

  try {
    const signature = await connection.sendTransaction(transaction, [keypair]);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature };
  } catch (err) {
    return { ok: false, error: err.message || "Transaction failed." };
  }
}

async function handleSetNetwork({ network }) {
  await storageSet({ [STORAGE_KEYS.NETWORK]: network });
  return { ok: true };
}

async function handleRevealMnemonic({ password }) {
  const { [STORAGE_KEYS.VAULT]: vault } = await storageGet(STORAGE_KEYS.VAULT);
  if (!vault) return { ok: false, error: "No wallet found." };
  try {
    const mnemonic = await decryptVault(vault, password);
    return { ok: true, mnemonic };
  } catch {
    return { ok: false, error: "Incorrect password." };
  }
}

// ---------- dApp connection approval flow ----------

async function openApprovalWindow(requestId, origin, kind) {
  const url = chrome.runtime.getURL(
    `src/popup/popup.html?mode=approve&requestId=${encodeURIComponent(requestId)}&origin=${encodeURIComponent(origin)}&kind=${kind}`
  );
  await chrome.windows.create({ url, type: "popup", width: 360, height: 600 });
}

function waitForApproval(requestId) {
  return new Promise((resolve, reject) => {
    pendingApprovals.set(requestId, { resolve, reject });
    // Give up if the user never responds.
    setTimeout(() => {
      if (pendingApprovals.has(requestId)) {
        pendingApprovals.delete(requestId);
        reject(new Error("Approval request timed out."));
      }
    }, 120_000);
  });
}

async function handleDappConnect({ origin }) {
  const keypair = await getActiveKeypair();
  const approvedOrigins = await getApprovedOrigins();

  if (keypair && approvedOrigins.includes(origin)) {
    return { ok: true, publicKey: keypair.publicKey.toBase58() };
  }

  const requestId = crypto.randomUUID();
  await openApprovalWindow(requestId, origin, "connect");
  try {
    await waitForApproval(requestId);
    await addApprovedOrigin(origin);
    const kp = await getActiveKeypair();
    if (!kp) return { ok: false, error: "Wallet is locked." };
    return { ok: true, publicKey: kp.publicKey.toBase58() };
  } catch (err) {
    return { ok: false, error: err.message || "Connection request was rejected." };
  }
}

async function handleDappSignTransaction({ origin, transactionBase64 }) {
  const approvedOrigins = await getApprovedOrigins();
  if (!approvedOrigins.includes(origin)) {
    return { ok: false, error: "This site isn't connected. Connect first." };
  }

  const requestId = crypto.randomUUID();
  await openApprovalWindow(requestId, origin, "sign");
  try {
    await waitForApproval(requestId);
    const keypair = await getActiveKeypair();
    if (!keypair) return { ok: false, error: "Wallet is locked." };

    const transaction = Transaction.from(Buffer.from(transactionBase64, "base64"));
    transaction.partialSign(keypair);
    return { ok: true, signedTransactionBase64: transaction.serialize().toString("base64") };
  } catch (err) {
    return { ok: false, error: err.message || "Signature request was rejected." };
  }
}

async function handleGetPendingApproval({ requestId }) {
  return { ok: true, requestId, pending: pendingApprovals.has(requestId) };
}

function handleApproveConnection({ requestId }) {
  const entry = pendingApprovals.get(requestId);
  if (entry) {
    entry.resolve();
    pendingApprovals.delete(requestId);
  }
  return { ok: true };
}

function handleRejectConnection({ requestId }) {
  const entry = pendingApprovals.get(requestId);
  if (entry) {
    entry.reject(new Error("Request was rejected."));
    pendingApprovals.delete(requestId);
  }
  return { ok: true };
}

// ---------- message router ----------

const handlers = {
  GET_STATE: handleGetState,
  CREATE_WALLET: handleCreateWallet,
  IMPORT_WALLET: handleImportWallet,
  UNLOCK: handleUnlock,
  LOCK: handleLock,
  GET_BALANCE: handleGetBalance,
  GET_TRANSACTIONS: handleGetTransactions,
  SEND_TRANSFER: handleSendTransfer,
  SET_NETWORK: handleSetNetwork,
  REVEAL_MNEMONIC: handleRevealMnemonic,
  DAPP_CONNECT: handleDappConnect,
  DAPP_SIGN_TRANSACTION: handleDappSignTransaction,
  APPROVE_CONNECTION: handleApproveConnection,
  REJECT_CONNECTION: handleRejectConnection,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];
  if (!handler) return false;

  Promise.resolve(handler(message, sender))
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));

  return true; // keep the message channel open for the async response
});
