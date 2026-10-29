'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import type { ClaimSDK, IdentitySDK } from '@goodsdks/citizen-sdk';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { celo } from 'viem/chains';
import { explorerUrl, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { classifyTransactionError } from '../web3/transactions';
import { formatRemaining, useNow } from '../features/tournament';
import { goodDollarAvailability, readGoodDollarCallback, recordGoodDollarVerification } from './service';
type View =
  | { status: 'loading' }
  | { status: 'not_whitelisted' }
  | { status: 'can_claim'; entitlement: bigint }
  | { status: 'already_claimed'; next: Date | undefined }
  | { status: 'error'; message: string };
type Action = { status: 'idle' } | { status: 'working'; label: string } | { status: 'done'; hash: string } | { status: 'failed'; message: string };
export function ClaimPanel() {
  const wallet = useWallet();
  const availability = goodDollarAvailability(publicConfig);
  if (availability.status === 'blocked') return <section className="panel"><EmptyState icon="leaf" title="Daily G$ is not available here"><p>{availability.reason}</p></EmptyState></section>;
  if (!wallet.live) return <section className="panel"><EmptyState icon="leaf" title="Daily G$ is not available here"><p>{wallet.message ?? 'Wallet connection is not configured for this environment.'}</p></EmptyState></section>;
  if (wallet.status !== 'connected' || !wallet.address) return <section className="panel"><EmptyState icon="leaf" title="Connect to claim daily G$"><p>Verified GoodDollar members can claim free G$ every day.</p></EmptyState></section>;
  if (wallet.wrongNetwork) return <section className="panel"><EmptyState icon="leaf" title="Switch to Celo"><p>GoodDollar claims run on Celo. Switch your wallet's network to continue.</p></EmptyState></section>;
  return <Claimer env={availability.env} />;
}
function Claimer({ env }: { env: 'production' | 'staging' | 'development' }) {
  const wallet = useWallet();
  const account = useAccount();
  const chain = celo;
  const publicClient = usePublicClient({ chainId: chain.id });
  const { data: walletClient } = useWalletClient({ chainId: chain.id });
  const [sdk, setSdk] = useState<{ identity: IdentitySDK; claim: ClaimSDK } | null>(null);
  const [view, setView] = useState<View>({ status: 'loading' });
  const [action, setAction] = useState<Action>({ status: 'idle' });
  const [stats, setStats] = useState<{ claimers: bigint; amount: bigint } | null>(null);
  const now = useNow();
  const callback = useMemo(
    () => typeof window === 'undefined' ? { status: 'none' as const } : readGoodDollarCallback(window.location.search),
    [],
  );
  // The SDK is loaded only on this page and always uses the app's own clients.
  useEffect(() => {
    if (!publicClient || !walletClient || !account.address) return;
    let cancelled = false;
    setView({ status: 'loading' });
    void (async () => {
      try {
        const { IdentitySDK, ClaimSDK } = await import('@goodsdks/citizen-sdk');
        const identity = new IdentitySDK({ account: account.address!, publicClient, walletClient, env });
        const claim = new ClaimSDK({ account: account.address!, publicClient, walletClient, identitySDK: identity, env });
        if (!cancelled) setSdk({ identity, claim });
      } catch { if (!cancelled) setView({ status: 'error', message: 'GoodDollar could not be reached. Try again shortly.' }); }
    })();
    return () => { cancelled = true; };
  }, [publicClient, walletClient, account.address, env]);
  const refresh = useCallback(async () => {
    if (!sdk) return;
    try {
      const result = await sdk.claim.getWalletClaimStatus();
      setView(result.status === 'can_claim' ? { status: 'can_claim', entitlement: result.entitlement }
        : result.status === 'already_claimed' ? { status: 'already_claimed', next: result.nextClaimTime }
        : { status: 'not_whitelisted' });
      if (account.address) {
        try {
          await recordGoodDollarVerification(publicConfig.backendUrl, account.address);
        } catch {
          setAction({ status: 'failed', message: 'GoodDollar status was confirmed, but Slyyce could not update its verification record.' });
        }
      }
      sdk.claim.getDailyStats().then(setStats, () => setStats(null));
    } catch { setView({ status: 'error', message: 'Your claim status could not be loaded.' }); }
  }, [sdk]);
  useEffect(() => {
    if (!sdk) return;
    void refresh().then(() => {
      if (callback.status === 'verified') setAction({ status: 'idle' });
    });
  }, [callback.status, refresh, sdk]);
  useEffect(() => {
    if (callback.status === 'none') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('isVerified');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    if (callback.status === 'failed') {
      setAction({ status: 'failed', message: callback.reason || 'GoodDollar verification was not completed.' });
    } else {
      setAction({ status: 'working', label: 'Confirming your GoodDollar verification…' });
    }
  }, [callback]);
  async function verify() {
    if (!sdk) return;
    setAction({ status: 'working', label: 'Sign the verification request in your wallet…' });
    try {
      const link = await sdk.identity.generateFVLink(false, window.location.href, chain.id);
      window.location.href = link;
    } catch (error) {
      setAction(classifyTransactionError(error) === 'rejected' ? { status: 'idle' } : { status: 'failed', message: 'Verification could not start. Try again.' });
    }
  }
  async function topUpGas() {
    if (!sdk) return;
    setAction({ status: 'working', label: 'Requesting free gas from GoodDollar…' });
    try {
      await sdk.claim.triggerFaucet();
      wallet.refreshBalance?.();
      setAction({ status: 'idle' });
    } catch { setAction({ status: 'failed', message: 'GoodDollar could not top up gas right now. Try again later.' }); }
  }
  async function claim() {
    if (!sdk) return;
    setAction({ status: 'working', label: 'Confirm the claim in your wallet, then wait for Celo…' });
    try {
      const receipt = await sdk.claim.claim();
      if (!receipt || receipt.status !== 'success') throw new Error('Claim transaction did not succeed');
      setAction({ status: 'done', hash: receipt.transactionHash });
      wallet.refreshBalance?.();
      await refresh();
    } catch (error) {
      setAction(classifyTransactionError(error) === 'rejected' ? { status: 'failed', message: 'You declined the request. Nothing was claimed.' } : { status: 'failed', message: error instanceof Error ? error.message : 'The claim failed.' });
    }
  }
  const busy = action.status === 'working' || !sdk;
  return <section className="panel claim-panel" aria-live="polite">
    {env !== 'production' && <p className="eyebrow">GOODDOLLAR {env.toUpperCase()} · TEST G$</p>}
    {view.status === 'loading' && <p className="loading-state" role="status">Checking your GoodDollar status…</p>}
    {view.status === 'error' && <EmptyState icon="leaf" title="Something went wrong"><p>{view.message}</p><button className="text-button" onClick={() => void refresh()}>Try again</button></EmptyState>}
    {view.status === 'not_whitelisted' && <EmptyState icon="shield" title="Verify once, claim every day" action={<button className="button" disabled={busy} onClick={() => void verify()}>Verify my identity</button>}>
      <p>GoodDollar gives free daily G$ to verified unique humans.</p>
      <p>Verification opens GoodDollar's official face-verification flow and checks your status again when you return.</p>
    </EmptyState>}
    {view.status === 'can_claim' && <EmptyState icon="leaf" title={formatTokenAmount(view.entitlement, gdDecimals) + ' G$ is ready'} action={<button className="button" disabled={busy} onClick={() => void claim()}>Claim daily G$</button>}>
      <p>Your daily GoodDollar UBI is waiting. Use it in the market or for tournament entries.</p></EmptyState>}
    {view.status === 'already_claimed' && <EmptyState icon="clock" title="You've claimed today"><p>{view.next ? 'Next claim in ' + formatRemaining(Math.floor(view.next.getTime() / 1000) - now) + '.' : 'Come back tomorrow for more G$.'}</p></EmptyState>}
    {wallet.gas === 'low' && view.status !== 'not_whitelisted' && view.status !== 'loading' && <p className="status-card" role="status">Low on CELO for network fees. <button className="text-button" disabled={busy} onClick={() => void topUpGas()}>Get free gas</button></p>}
    {action.status === 'working' && <p className="status-card" role="status">{action.label}</p>}
    {action.status === 'failed' && <p className="status-card error-text" role="alert">{action.message}</p>}
    {action.status === 'done' && <p className="status-card" role="status"><strong className="leaf">Claimed!</strong> <a href={explorerUrl('celo', 'tx', action.hash)} target="_blank" rel="noreferrer">View transaction ↗</a></p>}
    {stats && <p className="muted fine-print">Today: {stats.claimers.toLocaleString()} people claimed {Number(formatTokenAmount(stats.amount, gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })} G$.</p>}
  </section>;
}
