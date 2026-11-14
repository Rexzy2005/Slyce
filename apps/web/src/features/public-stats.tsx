'use client';
import Link from 'next/link';
import { useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { arcadeAbi, tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor, explorerUrl, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { RecentActivity } from './recent-activity';
import { useEffect, useState } from 'react';
import { apiFetch } from '../api/http';
import { GdFlowSection, useActivitySummary } from '../activity/gd-flow';
import { formatGd, gdTotal, spendKinds } from '../activity/format';
/**
 * Public, sign-in-free view of Slyyce's activity for players, judges and funders. The headline numbers are the same
 * ones the admin overview shows (backend chain index, ADR-0012, plus sign-up totals); contract reads add tournaments.
 */
export function PublicStats() {
  const wallet = useWallet();
  if (wallet.status === 'unavailable') return <p className="muted">Live stats are not configured for this environment.</p>;
  if (!wallet.live) return <p className="loading-state" role="status">Loading stats…</p>;
  return <Stats />;
}
function Stats() {
  const { arcade, tournament, shop, gd } = contractsFor(publicConfig);
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const reads = useReadContracts({
    contracts: arcade && tournament && chain ? [
      { address: arcade, abi: arcadeAbi, functionName: 'totalGames', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'playFee', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'tournamentCount', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'liabilities', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'openPrizeTournament', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'totalRewardsPaid', chainId: chain.id },
    ] as const : [],
    query: { enabled: !!arcade && !!tournament && !!chain, refetchInterval: 30_000 },
  });
  const [, fee, tournaments, held, openId] = reads.data?.map(entry => entry.result) ?? [];
  const { summary } = useActivitySummary();
  const signUps = useSignUps();
  const count = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
  const network = publicConfig.network;
  const link = (address: `0x${string}` | undefined, label: string) => address && network
    ? <li key={label}><a href={explorerUrl(network, 'address', address)} target="_blank" rel="noreferrer">{label} <code>{address.slice(0, 8)}…{address.slice(-6)}</code> ↗</a></li> : null;
  const g = (value: unknown) => typeof value === 'bigint' ? Number(formatTokenAmount(value, gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' G$' : '—';
  return <div className="stats">
    <Link href="/play" className="brand">slyyce<span className="brand-dot">/</span></Link>
    <h1>Live stats</h1>
    <p className="muted">Live numbers, updated as people play. Games, players, G$ and transactions are on-chain and can be checked in the contracts below{reads.isPending ? '…' : '.'}</p>
    {reads.isError && <p className="error-text" role="alert">Stats couldn't be loaded right now. <button className="text-button" onClick={() => void reads.refetch()}>Try again</button></p>}
    <dl className="stat-grid">
      <div><dt>Sign-ups</dt><dd>{count(signUps?.total)}</dd>{signUps && <small className="muted">+{signUps.last7d.toLocaleString()} in the last 7 days</small>}</div>
      <div><dt>Players</dt><dd>{count(summary?.users)}</dd></div>
      <div><dt>Verified players</dt><dd className="leaf">{count(summary?.verifiedUsers)}</dd></div>
      <div><dt>Games saved</dt><dd>{count(summary?.games)}</dd></div>
      <div><dt>G$ spent in Slyyce</dt><dd className="leaf">{summary ? formatGd(gdTotal(summary, spendKinds).amount.toString()) : '—'}</dd></div>
      <div><dt>Transactions</dt><dd>{count(summary?.transactions)}</dd></div>
      <div><dt>Tournaments run</dt><dd>{typeof tournaments === 'bigint' ? tournaments.toLocaleString() : '—'}</dd></div>
      <div><dt>Tournament open now</dt><dd>{typeof openId === 'bigint' && openId > 0n ? '#' + openId.toString() : 'None'}</dd></div>
      {typeof held === 'bigint' && held > 0n && <div><dt>G$ in prize pools</dt><dd className="leaf">{g(held)}</dd></div>}
      {typeof fee === 'bigint' && fee > 0n && <div><dt>Round fee</dt><dd>{g(fee)}</dd></div>}
    </dl>
    <GdFlowSection />
    <RecentActivity />
    <h2>Public records</h2>
    <ul className="stats-links">{link(arcade, 'SlyceArcade')}{link(tournament, 'SlyceTournament')}{link(shop, 'SlyceShop')}{link(gd, 'G$ token')}</ul>
    <p className="muted fine-print">Events: GameRecorded, MilestoneRewarded, Entered, ScoreSubmitted, ResultsPosted, PrizeClaimed, Purchased.</p>
    <Link className="button" href="/play">Play Slyyce</Link>
  </div>;
}

/** Public sign-up totals (counts only) from the backend. */
function useSignUps() {
  const [data, setData] = useState<{ total: number; last24h: number; last7d: number; last30d: number }>();
  useEffect(() => {
    if (!publicConfig.backendUrl) return;
    let active = true;
    void apiFetch(`${publicConfig.backendUrl}/api/v1/stats/sign-ups`)
      .then(async response => response.ok ? (await response.json() as { data: NonNullable<typeof data> }).data : undefined)
      .then(next => { if (active && next) setData(next); }, () => undefined);
    return () => { active = false; };
  }, []);
  return data;
}
