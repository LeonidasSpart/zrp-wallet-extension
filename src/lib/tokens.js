import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

/**
 * Fetches all SPL token balances for a wallet. Returns raw on-chain data
 * (mint address, amount, decimals) — no name/logo lookup, since token
 * metadata APIs currently require registering for an API key and are
 * mid-migration as of early 2026. Showing the mint address is honest and
 * dependency-free; swap in a metadata source later without touching this.
 */
export async function getTokenBalances(connection, ownerPublicKey) {
  const { value } = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  return value
    .map((entry) => {
      const info = entry.account.data.parsed.info;
      return {
        mint: info.mint,
        tokenAccount: entry.pubkey.toBase58(),
        amount: info.tokenAmount.uiAmount,
        rawAmount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
      };
    })
    .filter((t) => t.amount > 0);
}

/**
 * Builds a signed SPL token transfer. Creates the recipient's associated
 * token account first if it doesn't exist yet (the sender pays the small
 * one-time rent for that, same as every other Solana wallet does).
 */
export async function buildTokenTransfer({ connection, payer, mint, toOwner, rawAmount }) {
  const mintPubkey = new PublicKey(mint);
  const toOwnerPubkey = new PublicKey(toOwner);

  const fromAta = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);
  const toAta = await getAssociatedTokenAddress(mintPubkey, toOwnerPubkey);

  const transaction = new Transaction();

  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(payer.publicKey, toAta, toOwnerPubkey, mintPubkey)
    );
  }

  transaction.add(
    createTransferInstruction(fromAta, toAta, payer.publicKey, BigInt(rawAmount))
  );

  return transaction;
}
