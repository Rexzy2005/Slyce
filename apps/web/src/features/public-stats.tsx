'use client';
import Link from 'next/link';
import { useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { arcadeAbi, tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor, explorerUrl, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
/** Public, sign-in-free view of Slyce's on-chain activity for players, judges and funders. */
export function PublicStats() {
  const wallet = useWallet();
  if (wallet.status === 'unavailable') return <p className="muted">Live stats are not configured for this environment.</p>;
  if (!wallet.live) return <p className="loading-state" role="status">Reading Celo…</p>;
  return <Stats />;
}
function Stats() {
  const { arcade, tournament, shop, gd } = contractsFor(publicConfig);
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const reads = useReadContracts({
    contracts: arcade && tournament && chain ? [
      { address: arcade, abi: arcadeAbi, functionName: 'totalRounds', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'playFee', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'tournamentCount', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'liabilities', chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'openPrizeTournament', chainId: chain.id },
    ] as const : [],
    query: { enabled: !!arcade && !!tournament && !!chain, refetchInterval: 30_000 },
  });
  const [rounds, fee, tournaments, held, openId] = reads.data?.map(entry => entry.result) ?? [];
  const network = publicConfig.network;
  const link = (address: `0x${string}` | undefined, label: string) => address && network
    ? <li key={label}><a href={explorerUrl(network, 'address', address)} target="_blank" rel="noreferrer">{label} <code>{address.slice(0, 8)}…{address.slice(-6)}</code> ↗</a></li> : null;
  const g = (value: unknown) => typeof value === 'bigint' ? Number(formatTokenAmount(value, gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' G$' : '—';
  return <div className="stats">
    <Link href="/play" className="brand">slyce<span className="brand-dot">/</span></Link>
    <h1>Live on Celo</h1>
    <p className="muted">Every number below is read directly from Slyce's contracts on Celo mainnet{reads.isPending ? '…' : '.'}</p>
    {reads.isError && <p className="error-text" role="alert">On-chain data could not be read right now. <button className="text-button" onClick={() => void reads.refetch()}>Try again</button></p>}
    <dl className="stat-grid">
      <div><dt>Paid rounds</dt><dd>{typeof rounds === 'bigint' ? rounds.toLocaleString() : '—'}</dd></div>
      <div><dt>Round fee</dt><dd>{g(fee)}</dd></div>
      <div><dt>G$ held for prize winners</dt><dd className="leaf">{g(held)}</dd></div>
      <div><dt>Tournaments run</dt><dd>{typeof tournaments === 'bigint' ? tournaments.toLocaleString() : '—'}</dd></div>
      <div><dt>Prize pool open now</dt><dd>{typeof openId === 'bigint' && openId > 0n ? '#' + openId.toString() : 'None'}</dd></div>
    </dl>
    <h2>Contracts</h2>
    <ul className="stats-links">{link(arcade, 'SlyceArcade')}{link(tournament, 'SlyceTournament')}{link(shop, 'SlyceShop')}{link(gd, 'G$ token')}</ul>
    <p className="muted fine-print">Events: RoundPaid, PoolFundedByPlay, Entered, ScoreSubmitted, ResultsPosted, PrizeClaimed, Purchased.</p>
    <Link className="button" href="/play">Play Slyce</Link>
  </div>;
}
