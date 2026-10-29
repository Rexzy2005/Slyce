'use client';
import Link from 'next/link';
import { erc20Abi, type Abi, type Address, type ContractFunctionName } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { publicConfig } from '../config/public';
import { chainFor, contractsFor, gdDecimals } from './config';
import { useWallet } from './context';
import { TransactionStatus } from '../components/transaction-status';
import { TransactionFailure } from './transactions';
import { useContractWrite, type WriteCall } from './use-contract-write';
import { formatTokenAmount } from './units';
/**
 * Two explicit steps when needed: approve exactly `amount` G$ for `spender`, then run `call`.
 * Nothing is granted in the UI until the action's receipt confirms and `onConfirmed` re-reads chain state.
 */
export function TokenSpend<abi extends Abi, name extends ContractFunctionName<abi, 'nonpayable'>>({ spender, amount, approveAmount = amount, label, call, onConfirmed, disabled }: {
  spender: Address; amount: bigint; /** Allowance to request when approval is needed (≥ amount), e.g. several rounds at once. */ approveAmount?: bigint; label: string; call: WriteCall<abi, name>; onConfirmed: () => Promise<unknown>; disabled?: boolean;
}) {
  const wallet = useWallet();
  const account = useAccount();
  const token = contractsFor(publicConfig).gd;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const allowance = useReadContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: account.address ? [account.address, spender] : undefined, chainId: chain?.id, query: { enabled: !!token && !!account.address && !!chain } });
  const approve = useContractWrite();
  const action = useContractWrite();
  const busy = (state: { status: string }) => !['idle', 'success', 'rejected', 'failed'].includes(state.status);
  const pending = busy(approve.state) || busy(action.state);
  const insufficient = wallet.balance.raw !== undefined && wallet.balance.raw < amount;
  const checkBalance = () => { if (insufficient) throw new TransactionFailure('insufficient-balance', 'You need ' + formatTokenAmount(amount, gdDecimals) + ' G$. Claim daily G$ or top up first.'); };
  if (!token) return <p className="muted" role="status">G$ is not configured for this environment.</p>;
  if (wallet.status !== 'connected') return <p className="muted" role="status">Connect your wallet to continue.</p>;
  if (wallet.wrongNetwork) return <p className="error-text" role="alert">Switch your wallet to {chain?.name ?? 'the configured network'}.</p>;
  const needsApproval = amount > 0n && (allowance.data === undefined || allowance.data < amount);
  const allowAmount = approveAmount > amount ? approveAmount : amount;
  const have = wallet.balance.raw === undefined ? undefined : formatTokenAmount(wallet.balance.raw, gdDecimals);
  if (insufficient) return <div className="token-spend need-gd" role="status">
    <p><strong>You need {formatTokenAmount(amount, gdDecimals)} G$</strong> · you have {have ?? '0'} G$.</p>
    <p className="muted">Verified humans can claim free G$ every day from GoodDollar. It takes a minute.</p>
    <Link className="button" href="/get-gd">Get free G$</Link>
  </div>;
  return <div className="token-spend">
    {wallet.gas === 'low' && <p className="error-text" role="status">Low on CELO for network fees. <Link href="/get-gd">Get free gas</Link></p>}
    {needsApproval
      ? <><p className="spend-step"><strong>Step 1 of 2 · Allow Slyce to use your G$</strong><br /><span className="muted">A one-time permission for up to {formatTokenAmount(allowAmount, gdDecimals)} G$. Nothing is spent yet, and you still confirm each payment.</span></p>
        <button className="button" disabled={disabled || pending || allowance.isPending} onClick={() => void approve.execute({ address: token, abi: erc20Abi, functionName: 'approve', args: [spender, allowAmount] }, { check: checkBalance, onConfirmed: () => allowance.refetch() })}>{allowance.isPending ? 'Checking…' : 'Allow ' + formatTokenAmount(allowAmount, gdDecimals) + ' G$'}</button></>
      : <>{allowAmount > amount && <p className="spend-step"><strong>Step 2 of 2</strong></p>}
        <button className="button" disabled={disabled || pending} onClick={() => void action.execute(call, { check: checkBalance, onConfirmed: async () => { await Promise.all([onConfirmed(), allowance.refetch()]); wallet.refreshBalance?.(); } })}>{label}</button></>}
    {approve.state.status !== 'idle' && approve.state.status !== 'success' && <TransactionStatus state={approve.state} />}
    {action.state.status !== 'idle' && <TransactionStatus state={action.state} />}
  </div>;
}
