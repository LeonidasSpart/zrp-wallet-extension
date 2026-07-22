import { PublicKey } from "@solana/web3.js";

export const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const CACHE_KEY = "zrp_token_meta_cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;

function getMetadataPda(mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Manually decodes only the fields we need (name, symbol, uri) from a
 * Metaplex Metadata account's raw bytes. Layout: 1 byte key + 32 byte
 * update_authority + 32 byte mint, then three Borsh strings (u32 LE
 * length prefix + UTF-8 bytes) in order: name, symbol, uri. Everything
 * after that (creators, token standard, etc.) is irrelevant here, so we
 * stop reading once we have the uri.
 */
function decodeNameSymbolUri(data) {
  let offset = 1 + 32 + 32; // skip key, update_authority, mint

  function readString() {
    if (offset + 4 > data.length) throw new Error("truncated metadata account");
    const len = data.readUInt32LE(offset);
    offset += 4;
    if (offset + len > data.length) throw new Error("truncated metadata string");
    const str = data.slice(offset, offset + len).toString("utf8");
    offset += len;
    return str.replace(/\0/g, "").trim();
  }

  const name = readString();
  const symbol = readString();
  const uri = readString();
  return { name, symbol, uri };
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readCache() {
  const result = await chrome.storage.local.get(CACHE_KEY);
  return result[CACHE_KEY] || {};
}

async function writeCacheEntry(mint, entry) {
  const cache = await readCache();
  cache[mint] = { ...entry, fetchedAt: Date.now() };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

/**
 * Fetches on-chain name/symbol plus the off-chain image URL for a mint.
 * Returns null if the mint has no Metaplex metadata account, or if
 * anything in the chain fails — callers should fall back to showing the
 * mint address, not treat this as an error.
 */
export async function fetchTokenMetadata(connection, mintAddress) {
  const cache = await readCache();
  const cached = cache[mintAddress];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const mint = new PublicKey(mintAddress);
    const pda = getMetadataPda(mint);
    const accountInfo = await connection.getAccountInfo(pda);
    if (!accountInfo) {
      await writeCacheEntry(mintAddress, { name: null, symbol: null, image: null });
      return null;
    }

    const { name, symbol, uri } = decodeNameSymbolUri(accountInfo.data);

    let image = null;
    if (uri) {
      try {
        const json = await fetchWithTimeout(uri, FETCH_TIMEOUT_MS);
        image = json?.image || null;
      } catch {
        // Off-chain JSON fetch failed (slow gateway, bad URI, etc.) — we
        // still have name/symbol from on-chain data, so keep those.
      }
    }

    const entry = { name: name || null, symbol: symbol || null, image };
    await writeCacheEntry(mintAddress, entry);
    return entry;
  } catch {
    return null;
  }
}
