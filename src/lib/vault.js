// Encrypts the mnemonic at rest using a password-derived AES-GCM key.
// Nothing here ever leaves the device — this only touches chrome.storage.local.

const PBKDF2_ITERATIONS = 250_000;

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypts a mnemonic with a password. Returns a JSON-serializable vault. */
export async function encryptVault(mnemonic, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(mnemonic)
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Decrypts a vault with a password. Throws if the password is wrong
 * (AES-GCM's authentication tag check fails on any tampering/wrong key).
 */
export async function decryptVault(vault, password) {
  const salt = fromBase64(vault.salt);
  const iv = fromBase64(vault.iv);
  const ciphertext = fromBase64(vault.ciphertext);
  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
