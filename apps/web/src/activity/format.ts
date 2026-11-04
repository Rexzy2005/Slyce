import { gdDecimals } from '../web3/config';
import { formatTokenAmount } from '../web3/units';

/** Player activity rows served by the backend chain index (ADR-0012), shared by the admin console and /stats. */
export type ChainSummary = { users: number; verifiedUsers: number | null; transactions: number; games: number; earned: string; spent: string; indexedToBlock: number | null; latestBlock: number | null; catchingUp: boolean; byKind?: Partial<Record<TransactionKind, { count: number; amount: string }>> };
export type TransactionKind = keyof typeof kindLabels;
export type ChainTransaction = { id: string; kind: TransactionKind; account: string; transactionHash: string; blockNumber: number; timestamp: string | null; amount: string | null; direction: 'in' | 'out' | null; details: Record<string, string | number> };

export const kindLabels = {
  game: 'Game saved',
  milestone_reward: 'Milestone reward',
  round_fee: 'Round fee',
  rewards_funded: 'Reward pot funded',
  purchase: 'Shop purchase',
  tournament_entry: 'Tournament entry',
  sponsor: 'Tournament sponsor',
  tournament_score: 'Tournament score',
  prize_claim: 'Prize claimed',
  refund: 'Refund',
} as const;

const detailLabels: Record<string, string> = { gameId: 'game #', tournamentId: 'tournament #', itemId: 'item #', round: 'round #', bestCombo: 'combo', milestone: 'milestone' };
export const describe = (details: Record<string, string | number>) => Object.entries(details).map(([name, value]) => `${detailLabels[name] ?? name} ${typeof value === 'number' ? value.toLocaleString() : value}`.replace('# ', '#')).join(' · ') || '—';
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const formatGd = (amount: string) => `${Number(formatTokenAmount(BigInt(amount), gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} G$`;
export const when = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

/** G$ players put into Slyyce, and G$ Slyyce paid back out; owner funding of the reward pot is shown separately. */
export const spendKinds = ['purchase', 'tournament_entry', 'round_fee', 'sponsor'] as const satisfies readonly TransactionKind[];
export const payoutKinds = ['milestone_reward', 'prize_claim', 'refund'] as const satisfies readonly TransactionKind[];
export function gdTotal(summary: ChainSummary, kinds: readonly TransactionKind[]): { count: number; amount: bigint } {
  return kinds.reduce((sum, kind) => { const row = summary.byKind?.[kind]; return row ? { count: sum.count + row.count, amount: sum.amount + BigInt(row.amount) } : sum; }, { count: 0, amount: 0n });
}
