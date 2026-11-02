import type { Hash, TransactionReceipt } from 'viem';
export type FailureKind = 'insufficient-balance' | 'wrong-network' | 'rpc' | 'reverted' | 'synchronization' | 'unknown';
export type TransactionState =
  | { status: 'idle' | 'preparing' | 'awaiting_wallet' }
  | { status: 'submitted' | 'confirming'; hash: Hash }
  | { status: 'confirmed' | 'synchronizing' | 'success'; hash: Hash; receipt: TransactionReceipt }
  | { status: 'rejected'; message: string }
  | { status: 'failed'; kind: FailureKind; message: string; hash?: Hash; receipt?: TransactionReceipt };
const allowed: Record<TransactionState['status'], readonly TransactionState['status'][]> = {
  idle: ['preparing'], preparing: ['awaiting_wallet', 'failed'], awaiting_wallet: ['submitted', 'rejected', 'failed'],
  submitted: ['confirming', 'failed'], confirming: ['confirmed', 'failed'], confirmed: ['synchronizing'],
  synchronizing: ['success', 'failed'], success: ['idle'], rejected: ['idle'], failed: ['idle', 'confirming', 'synchronizing'],
};
export function transitionTransaction(current: TransactionState, next: TransactionState): TransactionState {
  if (!allowed[current.status].includes(next.status)) throw new Error('Invalid transaction transition: ' + current.status + ' → ' + next.status);
  if (current.status === 'failed' && next.status === 'synchronizing' && (!current.receipt || current.kind !== 'synchronization')) throw new Error('Only confirmed transactions can retry synchronization');
  if (current.status === 'failed' && next.status === 'confirming'
    && (!current.hash || current.receipt || !['rpc', 'unknown'].includes(current.kind))) {
    throw new Error('Only an unconfirmed submitted transaction can retry confirmation');
  }
  if ('hash' in current && current.hash && 'hash' in next && next.hash !== current.hash) throw new Error('Transaction hash changed without a confirmed replacement');
  if ('receipt' in next && next.receipt && (next.receipt.status !== 'success' || next.receipt.transactionHash !== next.hash)) throw new Error('Expected a successful matching receipt');
  return next;
}
export class TransactionFailure extends Error {
  constructor(public readonly kind: FailureKind, message: string) { super(message); }
}
export function classifyTransactionError(error: unknown): FailureKind | 'rejected' {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TransactionFailure) return current.kind;
    if ('code' in current && current.code === 4001) return 'rejected';
    if ('name' in current) {
      if (current.name === 'UserRejectedRequestError') return 'rejected';
      if (current.name === 'InsufficientFundsError') return 'insufficient-balance';
      if (current.name === 'ChainMismatchError' || current.name === 'SwitchChainError') return 'wrong-network';
      if (current.name === 'ContractFunctionRevertedError' || current.name === 'ExecutionRevertedError') return 'reverted';
      if (['HttpRequestError', 'TimeoutError', 'WebSocketRequestError'].includes(String(current.name))) return 'rpc';
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return 'unknown';
}
export interface TransactionOperations {
  /** Must validate account, chain, contracts, simulation and funds before prompting. */
  prepare(): Promise<void>;
  submit(): Promise<Hash>;
  receipt(hash: Hash): Promise<TransactionReceipt>;
  /** True only when the authoritative API/indexer reports the expected result. */
  synchronized(receipt: TransactionReceipt): Promise<boolean>;
}
/** No retries of submit; receipts and application synchronization have distinct ownership. */
export function createTransactionController(publish: (state: TransactionState) => void) {
  let state: TransactionState = { status: 'idle' };
  let busy = false;
  const move = (next: TransactionState) => { state = transitionTransaction(state, next); publish(state); };
  const sync = async (operations: TransactionOperations, receipt: TransactionReceipt) => {
    if (state.status !== 'synchronizing') move({ status: 'synchronizing', hash: receipt.transactionHash, receipt });
    try {
      if (await operations.synchronized(receipt)) move({ status: 'success', hash: receipt.transactionHash, receipt });
    } catch {
      move({ status: 'failed', kind: 'synchronization', message: 'Done, but your account didn\'t update. Tap retry.', hash: receipt.transactionHash, receipt });
    }
  };
  const confirmationFailure = (error: unknown, hash: Hash) => {
    const kind = classifyTransactionError(error);
    move({ status: 'failed', kind: kind === 'rejected' ? 'rpc' : kind, hash,
      message: kind === 'reverted'
        ? 'That didn\'t go through. Nothing was charged.'
        : 'We couldn\'t confirm whether that went through. Check your balance before trying again.' });
  };
  const confirm = async (operations: TransactionOperations, hash: Hash) => {
    move({ status: 'confirming', hash });
    const receipt = await operations.receipt(hash);
    // Validate identity before interpreting success OR revert: a replacement is a different transaction.
    if (receipt.transactionHash !== hash) throw new TransactionFailure('rpc', 'That request was replaced. Check your balance before trying again.');
    if (receipt.status !== 'success') throw new TransactionFailure('reverted', 'The transaction reverted.');
    move({ status: 'confirmed', hash, receipt });
    await sync(operations, receipt);
  };
  return {
    getState: () => state,
    reset() { if (busy) throw new Error('Transaction is still running'); move({ status: 'idle' }); },
    async run(operations: TransactionOperations) {
      if (busy || state.status !== 'idle') throw new Error('A transaction is already active; reset after reviewing its result');
      busy = true;
      let hash: Hash | undefined;
      let awaitingWallet = false;
      try {
        move({ status: 'preparing' }); await operations.prepare();
        move({ status: 'awaiting_wallet' }); awaitingWallet = true; hash = await operations.submit();
        move({ status: 'submitted', hash });
        await confirm(operations, hash);
      } catch (error) {
        const kind = classifyTransactionError(error);
        if (kind === 'rejected' && awaitingWallet && !hash) move({ status: 'rejected', message: 'Cancelled. Nothing was charged.' });
        else move({ status: 'failed', kind: kind === 'rejected' ? 'rpc' : kind,
          message: kind === 'reverted' ? 'That didn\'t go through. Nothing was charged.' : hash ? 'We couldn\'t confirm whether that went through. Check your balance before trying again.' : 'The transaction could not be completed.', ...(hash ? { hash } : {}) });
      } finally { busy = false; }
    },
    async retryConfirmation(operations: TransactionOperations) {
      if (busy || state.status !== 'failed' || !state.hash || state.receipt || !['rpc', 'unknown'].includes(state.kind)) {
        throw new Error('No unconfirmed transaction to check');
      }
      const hash = state.hash;
      busy = true;
      try { await confirm(operations, hash); }
      catch (error) { confirmationFailure(error, hash); }
      finally { busy = false; }
    },
    async retrySynchronization(operations: TransactionOperations) {
      if (busy || !('receipt' in state) || !state.receipt || !['synchronizing', 'failed'].includes(state.status)) throw new Error('No confirmed transaction awaiting synchronization');
      busy = true;
      try { await sync(operations, state.receipt); } finally { busy = false; }
    },
  };
}
