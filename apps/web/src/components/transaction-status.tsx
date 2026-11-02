import type { TransactionState } from '../web3/transactions';
const labels: Record<TransactionState['status'], string> = {
  idle: 'Ready', preparing: 'Getting ready', awaiting_wallet: 'Confirm to continue',
  submitted: 'Sent', confirming: 'Almost done…', confirmed: 'Done',
  synchronizing: 'Done. Updating your account…', success: 'Done', rejected: 'Cancelled', failed: 'Something went wrong',
};
export function TransactionStatus({ state }: { state: TransactionState }) {
  return <div role={state.status === 'failed' ? 'alert' : 'status'} aria-live="polite" className={'status-card ' + (state.status === 'failed' ? 'error-text' : '')}>
    <strong>{labels[state.status]}</strong>{'message' in state && <p>{state.message}</p>}
    {state.status === 'failed' && <p>Reason: {state.kind.replaceAll('-', ' ')}</p>}
  </div>;
}
