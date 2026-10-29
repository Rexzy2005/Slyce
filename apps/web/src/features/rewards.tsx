'use client';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { getAddress, isAddressEqual, type Address, type Hex } from 'viem';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { TransactionStatus } from '../components/transaction-status';
import { tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { useContractWrite } from '../web3/use-contract-write';
import { prizeLeaf, verifyProof } from '../web3/merkle';
import { requestValidated } from '../api/http';
import { ApiError } from '../api/errors';
const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value as Hex);
const resultsSchema = z.object({
  chainId: z.number(), tournament: z.string().regex(/^0x[0-9a-fA-F]{40}$/), id: z.string(), root: hex32,
  claims: z.record(z.string(), z.object({ rank: z.number(), score: z.number(), amount: z.string().regex(/^\d+$/), proof: z.array(hex32) })),
});
/** Published claim file (scripts/tournament-results.ts). The on-chain root is authoritative; the file is only checked against it. */
async function fetchResults(id: bigint, signal: AbortSignal) {
  try { return await requestValidated({ url: '/tournaments/' + id + '.json', method: 'GET' }, resultsSchema, signal); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}
export function Rewards() {
  const wallet = useWallet();
  if (!wallet.live) return <section className="panel"><EmptyState icon="gift" title="Rewards are getting ready"><p>{wallet.message ?? 'Wallet connection is not configured for this environment.'}</p></EmptyState></section>;
  return <TournamentPrizes />;
}
function TournamentPrizes() {
  const account = useAccount();
  const address = contractsFor(publicConfig).tournament;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const count = useReadContract({ address, abi: tournamentAbi, functionName: 'tournamentCount', chainId: chain?.id, query: { enabled: !!address && !!chain } });
  if (!address) return <section className="panel"><EmptyState icon="gift" title="Rewards are getting ready"><p>The tournament contract is not configured for this environment.</p></EmptyState></section>;
  if (!account.address) return <section className="panel"><EmptyState icon="gift" title="Connect to see your rewards"><p>Tournament prizes are tied to your wallet.</p></EmptyState></section>;
  if (count.isPending) return <section className="panel"><p className="loading-state" role="status">Checking your rewards…</p></section>;
  if (count.isError) return <section className="panel"><EmptyState icon="gift" title="Rewards could not load"><button className="text-button" onClick={() => void count.refetch()}>Try again</button></EmptyState></section>;
  const ids = Array.from({ length: Number(count.data) }, (_, index) => count.data - BigInt(index)).slice(0, 10);
  if (!ids.length) return <section className="panel"><EmptyState icon="gift" title="Nothing to claim just yet"><p>Win a tournament to earn G$ prizes.</p></EmptyState></section>;
  return <section className="panel"><p className="eyebrow">TOURNAMENT PRIZES</p><ul className="data-list">{ids.map(id => <PrizeRow key={id.toString()} id={id} tournament={address} player={account.address!} />)}</ul>
    <p className="muted fine-print">Streak rewards are not available yet.</p></section>;
}
function PrizeRow({ id, tournament, player }: { id: bigint; tournament: Address; player: Address }) {
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const reads = useReadContracts({ contracts: [
    { address: tournament, abi: tournamentAbi, functionName: 'getTournament', args: [id], chainId: chain?.id },
    { address: tournament, abi: tournamentAbi, functionName: 'prizeClaimed', args: [id, player], chainId: chain?.id },
  ] as const, allowFailure: false });
  const root = reads.data?.[0].resultsRoot;
  const posted = !!root && root !== '0x' + '0'.repeat(64);
  const results = useQuery({ queryKey: ['tournament-results', id.toString()], queryFn: ({ signal }) => fetchResults(id, signal), enabled: posted });
  const claim = useContractWrite();
  const label = 'Tournament #' + id;
  if (reads.isPending) return <li><span>{label}<small>Checking…</small></span></li>;
  if (reads.isError) return <li><span>{label}<small>Could not load</small></span></li>;
  if (!posted) return <li><span>{label}<small>Results not posted yet</small></span></li>;
  if (results.isPending) return <li><span>{label}<small>Loading results…</small></span></li>;
  const file = results.data;
  const entry = file && Number(file.chainId) === chain?.id && isAddressEqual(getAddress(file.tournament), tournament) && file.id === id.toString() && file.root === root ? file.claims[player.toLowerCase()] : undefined;
  const amount = entry ? BigInt(entry.amount) : 0n;
  // Never offer a claim the contract would reject.
  const valid = !!entry && !!root && verifyProof(entry.proof, root, prizeLeaf(id, player, amount));
  if (results.isError || (file && file.root !== root)) return <li><span>{label}<small>Results file is not available yet. Check back soon.</small></span></li>;
  if (!valid) return <li><span>{label}<small>No prize this time</small></span></li>;
  const claimed = reads.data[1];
  return <li><span>{label}<small>Rank #{entry.rank} · score {entry.score.toLocaleString()}</small></span>
    <span className="leaf">{formatTokenAmount(amount, gdDecimals)} G$</span>
    {claimed ? <span className="muted">Claimed</span> : <button className="button" disabled={!claim.ready || !['idle', 'success', 'rejected', 'failed'].includes(claim.state.status)} onClick={() => void claim.execute({ address: tournament, abi: tournamentAbi, functionName: 'claim', args: [id, amount, entry.proof] }, { onConfirmed: () => reads.refetch() })}>Claim</button>}
    {claim.state.status !== 'idle' && <TransactionStatus state={claim.state} />}</li>;
}
