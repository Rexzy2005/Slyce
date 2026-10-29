'use client';
import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { publicConfig } from '../config/public';
import { arcadeAbi } from '../web3/abis';
import { chainFor, contractsFor } from '../web3/config';
export interface Milestone { score: number; reward: bigint }
export interface PlayerStats { xp: bigint; bestScore: number; games: number; streak: number; earned: bigint }
const identityAbi = [{ type: 'function', name: 'getWhitelistedRoot', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address' }] }] as const;
const zero = '0x0000000000000000000000000000000000000000';
/** On-chain game records (SlyceArcade v2): milestones, a player's stats, verification and today's rewarded milestones. */
export function useGameRecords(player: Address | undefined) {
  const arcade = contractsFor(publicConfig).arcade;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const base = useReadContracts({
    contracts: arcade && chain ? [
      { address: arcade, abi: arcadeAbi, functionName: 'milestones', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'identity', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'gameRules', chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'rewardBudget', chainId: chain.id },
    ] as const : [],
    query: { enabled: !!arcade && !!chain },
  });
  const mine = useReadContracts({
    contracts: arcade && chain && player ? [
      { address: arcade, abi: arcadeAbi, functionName: 'playerStats', args: [player], chainId: chain.id },
      { address: arcade, abi: arcadeAbi, functionName: 'rewardedToday', args: [player], chainId: chain.id },
    ] as const : [],
    query: { enabled: !!arcade && !!chain && !!player },
  });
  const [milestonesRaw, identityRaw, rulesRaw, budgetRaw] = base.data?.map(entry => entry.result) ?? [];
  const [statsRaw, rewardedRaw] = mine.data?.map(entry => entry.result) ?? [];
  const identity = typeof identityRaw === 'string' && identityRaw !== zero ? identityRaw as Address : undefined;
  const root = useReadContracts({
    contracts: identity && player && chain ? [{ address: identity, abi: identityAbi, functionName: 'getWhitelistedRoot', args: [player], chainId: chain.id }] as const : [],
    query: { enabled: !!identity && !!player && !!chain },
  });
  const rootValue = root.data?.[0]?.result;
  const milestones: Milestone[] = Array.isArray(milestonesRaw) ? (milestonesRaw as readonly { score: number; reward: bigint }[]).map(m => ({ score: Number(m.score), reward: m.reward })) : [];
  const s = statsRaw as { xp: bigint; bestScore: number; games: number; streak: number; earned: bigint } | undefined;
  const stats: PlayerStats | undefined = s ? { xp: s.xp, bestScore: Number(s.bestScore), games: Number(s.games), streak: Number(s.streak), earned: s.earned } : undefined;
  const rules = rulesRaw as readonly [number, number] | undefined;
  return {
    arcade, loading: base.isPending, error: base.isError, milestones, stats,
    open: !!rules && Number(rules[0]) > 0, maxScore: rules ? Number(rules[0]) : 0,
    budget: typeof budgetRaw === 'bigint' ? budgetRaw : undefined,
    rewardedMask: typeof rewardedRaw === 'bigint' ? rewardedRaw : 0n,
    // Unknown (undefined) when the contract can't answer yet; false only when no identity gate is configured.
    verified: identityRaw === undefined ? undefined : identity ? (rootValue === undefined ? undefined : rootValue !== zero) : false,
    refetch: async () => { await Promise.all([base.refetch(), mine.refetch(), root.refetch()]); },
  };
}
/** Milestones this score reaches that have not been rewarded today. */
export function newMilestones(milestones: Milestone[], score: number, rewardedMask: bigint) {
  return milestones.filter((m, i) => score >= m.score && (rewardedMask & (1n << BigInt(i))) === 0n);
}
