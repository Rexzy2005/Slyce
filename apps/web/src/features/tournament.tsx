'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { TransactionStatus } from '../components/transaction-status';
import { readBestScore } from '../game/best-score';
import { tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { TokenSpend } from '../web3/token-spend';
import { formatTokenAmount } from '../web3/units';
import { useContractWrite } from '../web3/use-contract-write';
const zero = '0x0000000000000000000000000000000000000000' as const;
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs); return () => clearInterval(timer); }, [intervalMs]);
  return now;
}
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}
export function Tournament() {
  const wallet = useWallet();
  if (!wallet.live) return <section className="panel"><EmptyState icon="trophy" title="Tournaments are getting ready"><p>{wallet.message ?? 'Wallet connection is not configured for this environment.'}</p></EmptyState></section>;
  return <CurrentTournament />;
}
function CurrentTournament() {
  const account = useAccount();
  const now = useNow();
  const address = contractsFor(publicConfig).tournament;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const count = useReadContract({ address, abi: tournamentAbi, functionName: 'tournamentCount', chainId: chain?.id, query: { enabled: !!address && !!chain } });
  const id = count.data && count.data > 0n ? count.data : undefined;
  const reads = useReadContracts({
    contracts: address && id ? [
      { address, abi: tournamentAbi, functionName: 'getTournament', args: [id], chainId: chain?.id },
      { address, abi: tournamentAbi, functionName: 'entered', args: [id, account.address ?? zero], chainId: chain?.id },
      { address, abi: tournamentAbi, functionName: 'bestScore', args: [id, account.address ?? zero], chainId: chain?.id },
    ] as const : [],
    allowFailure: false,
    query: { enabled: !!address && !!id },
  });
  const submit = useContractWrite();
  const human = useVerifiedHuman(address);
  const [practiceBest, setPracticeBest] = useState<number | null>(null);
  useEffect(() => setPracticeBest(readBestScore('normal')), []);
  if (!address) return <section className="panel"><EmptyState icon="trophy" title="Tournaments are getting ready"><p>The tournament contract is not configured for this environment.</p></EmptyState></section>;
  if (count.isPending || (id && reads.isPending)) return <section className="panel"><p className="loading-state" role="status">Loading the tournament…</p></section>;
  if (count.isError || reads.isError) return <section className="panel"><EmptyState icon="trophy" title="The tournament could not load"><p>Tournament details could not be read from the blockchain.</p><button className="text-button" onClick={() => { void count.refetch(); void reads.refetch(); }}>Try again</button></EmptyState></section>;
  if (!id || !reads.data) return <section className="panel"><EmptyState icon="trophy" title="No tournament yet"><p>The first tournament hasn't been scheduled. Sharpen your skills in practice.</p><Link className="button" href="/play/arena">Practice now</Link></EmptyState></section>;
  const [details, entered, submitted] = reads.data as readonly [{ startTime: bigint; endTime: bigint; resultsPostedAt: bigint; entrants: number; maxEntrants: number; cancelled: boolean; entryFee: bigint; pool: bigint }, boolean, number];
  const { startTime, endTime, resultsPostedAt, entrants, maxEntrants, cancelled, entryFee, pool } = details;
  const start = Number(startTime), end = Number(endTime);
  const phase = cancelled ? 'cancelled' : resultsPostedAt > 0n ? 'results' : now < start ? 'upcoming' : now < end ? 'open' : 'closed';
  const full = maxEntrants > 0 && entrants >= maxEntrants;
  const signedIn = !!account.address;
  const canSubmit = phase === 'open' && entered && practiceBest !== null && practiceBest > submitted;
  return <section className="panel tournament-panel">
    <p className="eyebrow">TOURNAMENT #{id.toString()} · {phase === 'open' ? 'OPEN' : phase === 'upcoming' ? 'STARTS SOON' : phase === 'closed' ? 'ENDED · RESULTS PENDING' : phase === 'cancelled' ? 'CANCELLED · REFUNDS OPEN' : 'RESULTS POSTED'}</p>
    <dl className="stat-grid">
      <div><dt>Prize pool</dt><dd className="sky">{formatTokenAmount(pool, gdDecimals)} G$</dd></div>
      <div><dt>Entry</dt><dd>{entryFee === 0n ? 'Free' : formatTokenAmount(entryFee, gdDecimals) + ' G$'}</dd></div>
      <div><dt>{phase === 'upcoming' ? 'Starts in' : 'Time left'}</dt><dd>{phase === 'upcoming' ? formatRemaining(start - now) : phase === 'open' ? formatRemaining(end - now) : 'Closed'}</dd></div>
      <div><dt>Players</dt><dd>{entrants}{maxEntrants > 0 ? ' / ' + maxEntrants : ''}</dd></div>
    </dl>
    {!signedIn ? <p className="muted" role="status">Connect your wallet to enter.</p>
      : phase === 'cancelled' ? <Refund id={id} address={address} onDone={() => reads.refetch()} />
      : !entered ? phase === 'open' && !full
        ? human === 'unverified'
          ? <div className="entered-state"><p><strong>Prizes are for verified humans.</strong> Verify once with GoodDollar (a quick face check) to enter. You'll also unlock free daily G$.</p><Link className="button" href="/get-gd">Verify with GoodDollar</Link></div>
          : <TokenSpend spender={address} amount={entryFee} label={entryFee === 0n ? 'Enter for free' : 'Enter for ' + formatTokenAmount(entryFee, gdDecimals) + ' G$'} call={{ address, abi: tournamentAbi, functionName: 'enter', args: [id] }} onConfirmed={() => reads.refetch()} />
        : <p className="muted">{full ? 'This tournament is full.' : 'Entries are closed for this tournament.'}</p>
      : <div className="entered-state"><p><strong className="leaf">You're in.</strong> Your submitted score: <strong>{submitted > 0 ? submitted.toLocaleString() : 'none yet'}</strong></p>
        {phase === 'open' && <><p className="muted">Your best Normal-difficulty practice score on this device: <strong>{practiceBest?.toLocaleString() ?? 'none yet'}</strong></p>
          <div className="action-row"><Link className="button secondary" href="/play/arena">Play a round</Link>
            <button className="button" disabled={!canSubmit || !submit.ready || !['idle', 'success', 'rejected', 'failed'].includes(submit.state.status)} onClick={() => { if (practiceBest !== null) void submit.execute({ address, abi: tournamentAbi, functionName: 'submitScore', args: [id, practiceBest] }, { onConfirmed: () => reads.refetch() }); }}>Submit {practiceBest?.toLocaleString() ?? ''}</button></div>
          {submit.state.status !== 'idle' && <TransactionStatus state={submit.state} />}</>}
        {phase === 'results' && <Link className="button" href="/rewards">Check your rewards</Link>}</div>}
    {(phase === 'closed' || phase === 'results' || phase === 'cancelled') && <NextTournament address={address} onStarted={async () => { await Promise.all([count.refetch(), reads.refetch()]); }} />}
    <p className="muted fine-print">Tournament play uses Normal difficulty. Scores are self-reported from your device and reviewed by the Slyyce operator, who posts the winners on-chain after the tournament closes. Default split: 50% / 30% / 20% of the pool to the top three. One entry per GoodDollar-verified human. Prize pools are funded by Slyyce and sponsors.</p>
  </section>;
}
function Refund({ id, address, onDone }: { id: bigint; address: `0x${string}`; onDone: () => Promise<unknown> }) {
  const account = useAccount();
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const refunded = useReadContract({ address, abi: tournamentAbi, functionName: 'refunded', args: [id, account.address ?? zero], chainId: chain?.id });
  const write = useContractWrite();
  if (refunded.data) return <p className="muted">Your refund has been returned to your wallet.</p>;
  return <div className="entered-state"><p>This tournament was cancelled. Entry fees and sponsorships are refunded in full.</p>
    <button className="button" disabled={!write.ready || !['idle', 'success', 'rejected', 'failed'].includes(write.state.status)} onClick={() => void write.execute({ address, abi: tournamentAbi, functionName: 'refund', args: [id] }, { onConfirmed: async () => { await Promise.all([refunded.refetch(), onDone()]); } })}>Claim refund</button>
    {write.state.status !== 'idle' && <TransactionStatus state={write.state} />}</div>;
}
const identityAbi = [{ type: 'function', name: 'getWhitelistedRoot', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address' }] }] as const;
/** Mirrors SlyceTournament's on-chain gate: 'open' when no Identity is set, else whether the wallet is a verified human. */
function useVerifiedHuman(tournament: `0x${string}` | undefined): 'open' | 'verified' | 'unverified' | 'unknown' {
  const account = useAccount();
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const gate = useReadContract({ address: tournament, abi: tournamentAbi, functionName: 'identity', chainId: chain?.id, query: { enabled: !!tournament && !!chain } });
  const gated = !!gate.data && gate.data !== zero;
  const root = useReadContract({ address: gated ? gate.data : undefined, abi: identityAbi, functionName: 'getWhitelistedRoot', args: account.address ? [account.address] : undefined, chainId: chain?.id, query: { enabled: gated && !!account.address } });
  if (gate.data === undefined) return 'unknown';
  if (!gated) return 'open';
  if (root.data === undefined) return 'unknown';
  return root.data === zero ? 'unverified' : 'verified';
}
/** Tournaments start automatically on the next paid round; anyone can also start the next one from here. */
function NextTournament({ address, onStarted }: { address: `0x${string}`; onStarted: () => Promise<unknown> }) {
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const duration = useReadContract({ address, abi: tournamentAbi, functionName: 'autoDuration', chainId: chain?.id });
  const start = useContractWrite();
  if (!duration.data) return null;
  const hours = Number(duration.data) / 3600;
  return <div className="entered-state"><p><strong>The next {hours >= 24 && hours % 24 === 0 ? (hours / 24 === 1 ? 'daily' : hours / 24 + '-day') : hours + '-hour'} tournament</strong> starts with the next round anyone plays, or start it now.</p>
    <button className="button secondary" disabled={!start.ready || !['idle', 'success', 'rejected', 'failed'].includes(start.state.status)} onClick={() => void start.execute({ address, abi: tournamentAbi, functionName: 'ensurePrizeTournament', args: [] }, { onConfirmed: onStarted })}>Start the next tournament</button>
    {start.state.status !== 'idle' && <TransactionStatus state={start.state} />}</div>;
}
