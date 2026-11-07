import type { Hash, TransactionReceipt } from 'viem';
/** Uses the configured public client's receipt waiter, not a wallet approval result. */
export function receiptReader(client: { waitForTransactionReceipt(parameters: { hash: Hash; confirmations: number; timeout: number }): Promise<TransactionReceipt> }) {
  return (hash: Hash) => client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
}
/**
 * Re-reads until the confirmed change is visible. Load-balanced RPCs (e.g. forno) can answer from a node a block
 * behind the one that returned the receipt, so a single refetch may still show the old state.
 */
export async function refetchUntil<T>(refetch: () => Promise<{ data?: T | undefined }>, done: (data: T | undefined) => boolean, attempts = 10, delayMs = 800): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (done((await refetch()).data)) return true;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}
