// @solana/web3.js expects Node's Buffer global, which doesn't exist in a
// service worker or browser page context. This makes it available.
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
