import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";

// Standard Solana derivation path used by Phantom, Solflare, etc. — a
// mnemonic generated or imported here derives the same address those
// wallets would produce for account 0.
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

/** Generates a new 12-word BIP39 mnemonic (128 bits of entropy). */
export function generateMnemonic() {
  return bip39.generateMnemonic(128);
}

/** Validates a mnemonic's checksum/wordlist before accepting an import. */
export function isValidMnemonic(mnemonic) {
  return bip39.validateMnemonic(mnemonic.trim());
}

/** Derives the primary Solana Keypair (account 0) from a mnemonic. */
export function keypairFromMnemonic(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex"));
  return Keypair.fromSeed(key);
}
