export async function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

export async function storageSet(items) {
  return chrome.storage.local.set(items);
}

export async function storageRemove(keys) {
  return chrome.storage.local.remove(keys);
}

export const STORAGE_KEYS = {
  VAULT: "zrp_vault", // encrypted mnemonic
  NETWORK: "zrp_network", // "mainnet-beta" | "devnet"
};
