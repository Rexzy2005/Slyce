'use client';
import { useReadContract } from 'wagmi';
import { publicConfig } from '../config/public';
import { tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor } from '../web3/config';
/** Today's prize tournament (if open) and its live G$ pool, which every paid round grows. */
export function usePrizePool() {
  const tournament = contractsFor(publicConfig).tournament;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const open = useReadContract({ address: tournament, abi: tournamentAbi, functionName: 'openPrizeTournament', chainId: chain?.id, query: { enabled: !!tournament && !!chain, refetchInterval: 30_000 } });
  const id = open.data && open.data > 0n ? open.data : undefined;
  const details = useReadContract({ address: tournament, abi: tournamentAbi, functionName: 'getTournament', args: id ? [id] : undefined, chainId: chain?.id, query: { enabled: !!tournament && !!id, refetchInterval: 15_000 } });
  return { id, pool: details.data?.pool, endTime: details.data?.endTime, refetch: () => { void open.refetch(); void details.refetch(); } };
}
