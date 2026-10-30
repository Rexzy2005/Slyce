import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { celo } from 'viem/chains';
import type { AuthenticatedPrincipal } from './security.js';
import { requireAdministrator } from './security.js';

/**
 * Admin visibility of player activity on the Slyyce contracts (ADR-0012).
 * The chain is the source of truth; this is an in-memory index rebuilt from logs on start.
 */
export const chainActivityEvents = parseAbi([
  'event GameRecorded(address indexed player, uint64 indexed gameId, uint32 score, uint32 bestCombo, uint32 fruits, uint64 xpGained)',
  'event MilestoneRewarded(address indexed player, uint64 indexed gameId, uint32 milestoneScore, uint128 reward)',
  'event RoundPaid(address indexed player, uint64 indexed round, uint64 playerRound, uint128 fee, uint256 prizeTournament)',
  'event RewardsFunded(address indexed funder, uint128 amount)',
  'event Purchased(address indexed buyer, uint256 indexed itemId, uint256 quantity, uint256 paid)',
  'event Entered(uint256 indexed id, address indexed player, uint128 fee)',
  'event Sponsored(uint256 indexed id, address indexed sponsor, uint128 amount)',
  'event ScoreSubmitted(uint256 indexed id, address indexed player, uint32 score)',
  'event PrizeClaimed(uint256 indexed id, address indexed player, uint128 amount)',
  'event Refunded(uint256 indexed id, address indexed account, uint128 amount)',
]);

export type ChainTransactionKind = 'game' | 'milestone_reward' | 'round_fee' | 'rewards_funded' | 'purchase' | 'tournament_entry' | 'sponsor' | 'tournament_score' | 'prize_claim' | 'refund';
export const chainTransactionKinds: readonly ChainTransactionKind[] = ['game', 'milestone_reward', 'round_fee', 'rewards_funded', 'purchase', 'tournament_entry', 'sponsor', 'tournament_score', 'prize_claim', 'refund'];

export interface ChainTransaction {
  id: string;
  kind: ChainTransactionKind;
  account: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string | null;
  /** G$ in smallest units; `in` = paid to the account, `out` = paid by it. */
  amount: string | null;
  direction: 'in' | 'out' | null;
  details: Record<string, string | number>;
}

export interface ChainUser {
  address: string;
  firstSeen: string | null;
  lastSeen: string | null;
  transactions: number;
  games: number;
  bestScore: number;
  xp: number;
  earned: string;
  spent: string;
}

export interface ChainActivitySummary {
  users: number;
  transactions: number;
  games: number;
  earned: string;
  spent: string;
  indexedToBlock: number | null;
  latestBlock: number | null;
  catchingUp: boolean;
}

/** A decoded log as returned by viem `getLogs({ events })`. */
export interface ActivityLog {
  eventName: string;
  args: Record<string, unknown>;
  transactionHash: string | null;
  blockNumber: bigint | null;
  logIndex: number | null;
  blockTimestamp?: bigint | null | undefined;
}

export interface ActivityLogSource {
  latestBlock(): Promise<bigint>;
  logs(fromBlock: bigint, toBlock: bigint): Promise<readonly ActivityLog[]>;
}

export interface ChainActivityConfig {
  rpcUrl: string;
  contracts: readonly Address[];
  startBlock: bigint;
}

export function createViemActivitySource(config: ChainActivityConfig): ActivityLogSource {
  const client = createPublicClient({ chain: celo, transport: http(config.rpcUrl) });
  return {
    latestBlock: () => client.getBlockNumber(),
    logs: async (fromBlock, toBlock) => await client.getLogs({ address: [...config.contracts], events: chainActivityEvents, fromBlock, toBlock }) as unknown as ActivityLog[],
  };
}

const bigintText = (value: unknown) => (typeof value === 'bigint' ? value : 0n).toString();
const numberValue = (value: unknown) => typeof value === 'bigint' ? Number(value) : typeof value === 'number' ? value : 0;
const addressValue = (value: unknown) => typeof value === 'string' ? value.toLowerCase() : '';

export function toChainTransaction(log: ActivityLog): ChainTransaction | null {
  if (!log.transactionHash || log.blockNumber === null || log.logIndex === null) return null;
  const a = log.args;
  const base = {
    id: `${log.transactionHash}:${log.logIndex}`,
    transactionHash: log.transactionHash,
    blockNumber: Number(log.blockNumber),
    timestamp: typeof log.blockTimestamp === 'bigint' ? new Date(Number(log.blockTimestamp) * 1000).toISOString() : null,
  };
  const row = (kind: ChainTransactionKind, account: unknown, amount: unknown, direction: 'in' | 'out' | null, details: Record<string, string | number>): ChainTransaction =>
    ({ ...base, kind, account: addressValue(account), amount: direction ? bigintText(amount) : null, direction, details });
  switch (log.eventName) {
    case 'GameRecorded': return row('game', a.player, null, null, { gameId: bigintText(a.gameId), score: numberValue(a.score), bestCombo: numberValue(a.bestCombo), fruits: numberValue(a.fruits), xp: numberValue(a.xpGained) });
    case 'MilestoneRewarded': return row('milestone_reward', a.player, a.reward, 'in', { gameId: bigintText(a.gameId), milestone: numberValue(a.milestoneScore) });
    case 'RoundPaid': return row('round_fee', a.player, a.fee, 'out', { round: bigintText(a.round), tournamentId: bigintText(a.prizeTournament) });
    case 'RewardsFunded': return row('rewards_funded', a.funder, a.amount, 'out', {});
    case 'Purchased': return row('purchase', a.buyer, a.paid, 'out', { itemId: bigintText(a.itemId), quantity: numberValue(a.quantity) });
    case 'Entered': return row('tournament_entry', a.player, a.fee, 'out', { tournamentId: bigintText(a.id) });
    case 'Sponsored': return row('sponsor', a.sponsor, a.amount, 'out', { tournamentId: bigintText(a.id) });
    case 'ScoreSubmitted': return row('tournament_score', a.player, null, null, { tournamentId: bigintText(a.id), score: numberValue(a.score) });
    case 'PrizeClaimed': return row('prize_claim', a.player, a.amount, 'in', { tournamentId: bigintText(a.id) });
    case 'Refunded': return row('refund', a.account, a.amount, 'in', { tournamentId: bigintText(a.id) });
    default: return null;
  }
}

interface UserAccumulator { address: string; first: ChainTransaction; last: ChainTransaction; transactions: number; games: number; bestScore: number; xp: number; earned: bigint; spent: bigint }

export interface ChainActivityIndexOptions {
  /** Provider limit: forno rejects eth_getLogs ranges over 5,000 blocks. */
  chunkSize?: bigint;
  concurrency?: number;
  /** Chunks scanned per sync so one admin request stays bounded. */
  maxChunksPerSync?: number;
  minSyncIntervalMs?: number;
  confirmations?: bigint;
  now?: () => number;
}

const order = (a: ChainTransaction, b: ChainTransaction) => b.blockNumber - a.blockNumber || b.id.localeCompare(a.id);

export class ChainActivityIndex {
  private readonly rows = new Map<string, ChainTransaction>();
  private sorted: ChainTransaction[] = [];
  private users = new Map<string, UserAccumulator>();
  private nextBlock: bigint;
  private latest: bigint | null = null;
  private lastSync = 0;
  private running: Promise<void> | null = null;
  private readonly chunkSize: bigint;
  private readonly concurrency: number;
  private readonly maxChunksPerSync: number;
  private readonly minSyncIntervalMs: number;
  private readonly confirmations: bigint;
  private readonly now: () => number;

  constructor(private readonly source: ActivityLogSource, startBlock: bigint, options: ChainActivityIndexOptions = {}) {
    this.nextBlock = startBlock;
    this.chunkSize = options.chunkSize ?? 5_000n;
    this.concurrency = options.concurrency ?? 4;
    this.maxChunksPerSync = options.maxChunksPerSync ?? 200;
    this.minSyncIntervalMs = options.minSyncIntervalMs ?? 15_000;
    this.confirmations = options.confirmations ?? 2n;
    this.now = options.now ?? Date.now;
  }

  /** Scans new blocks; concurrent callers share one scan and repeat calls are throttled. */
  sync(): Promise<void> {
    if (this.running) return this.running;
    if (this.latest !== null && !this.catchingUp() && this.now() - this.lastSync < this.minSyncIntervalMs) return Promise.resolve();
    this.running = this.scan().finally(() => { this.running = null; });
    return this.running;
  }

  private catchingUp(): boolean { return this.latest !== null && this.nextBlock <= this.latest; }

  private async scan(): Promise<void> {
    const head = await this.source.latestBlock() - this.confirmations;
    this.latest = head;
    const ranges: [bigint, bigint][] = [];
    for (let from = this.nextBlock; from <= head && ranges.length < this.maxChunksPerSync; from += this.chunkSize) {
      const to = from + this.chunkSize - 1n;
      ranges.push([from, to < head ? to : head]);
    }
    for (let i = 0; i < ranges.length; i += this.concurrency) {
      const batch = ranges.slice(i, i + this.concurrency);
      const results = await Promise.all(batch.map(([from, to]) => this.source.logs(from, to)));
      for (const logs of results) for (const log of logs) { const row = toChainTransaction(log); if (row) this.rows.set(row.id, row); }
      this.nextBlock = batch.at(-1)![1] + 1n;
    }
    this.rebuild();
    this.lastSync = this.now();
  }

  private rebuild(): void {
    this.sorted = [...this.rows.values()].sort(order);
    const users = new Map<string, UserAccumulator>();
    for (let i = this.sorted.length - 1; i >= 0; i -= 1) {
      const row = this.sorted[i]!;
      const user = users.get(row.account) ?? { address: row.account, first: row, last: row, transactions: 0, games: 0, bestScore: 0, xp: 0, earned: 0n, spent: 0n };
      user.last = row; user.transactions += 1;
      if (row.kind === 'game') { user.games += 1; user.xp += Number(row.details.xp ?? 0); user.bestScore = Math.max(user.bestScore, Number(row.details.score ?? 0)); }
      if (row.amount && row.direction === 'in') user.earned += BigInt(row.amount);
      if (row.amount && row.direction === 'out') user.spent += BigInt(row.amount);
      users.set(row.account, user);
    }
    this.users = users;
  }

  summary(): ChainActivitySummary {
    let earned = 0n; let spent = 0n; let games = 0;
    for (const user of this.users.values()) { earned += user.earned; spent += user.spent; games += user.games; }
    return { users: this.users.size, transactions: this.sorted.length, games, earned: earned.toString(), spent: spent.toString(), indexedToBlock: this.nextBlock > 0n ? Number(this.nextBlock - 1n) : null, latestBlock: this.latest === null ? null : Number(this.latest), catchingUp: this.catchingUp() };
  }

  listTransactions(input: { cursor?: string | undefined; limit: number; kind?: ChainTransactionKind | undefined; account?: string | undefined }): { items: ChainTransaction[]; nextCursor: string | null } {
    const account = input.account?.toLowerCase();
    const filtered = this.sorted.filter(row => (!input.kind || row.kind === input.kind) && (!account || row.account === account));
    return page(filtered, input.cursor, input.limit);
  }

  listUsers(input: { cursor?: string | undefined; limit: number; search?: string | undefined }): { items: ChainUser[]; nextCursor: string | null } {
    const search = input.search?.toLowerCase();
    const users = [...this.users.values()]
      .filter(user => !search || user.address.includes(search))
      .sort((a, b) => order(a.last, b.last))
      .map(user => ({ address: user.address, firstSeen: user.first.timestamp, lastSeen: user.last.timestamp, transactions: user.transactions, games: user.games, bestScore: user.bestScore, xp: user.xp, earned: user.earned.toString(), spent: user.spent.toString() }));
    return page(users, input.cursor, input.limit);
  }
}

function page<T>(items: readonly T[], cursor: string | undefined, limit: number): { items: T[]; nextCursor: string | null } {
  const offset = cursor ? Number(cursor) : 0;
  const selected = items.slice(offset, offset + limit);
  return { items: selected, nextCursor: offset + limit < items.length ? String(offset + limit) : null };
}

export class ChainActivityService {
  constructor(private readonly index: ChainActivityIndex) {}
  private async ready(principal: AuthenticatedPrincipal) { requireAdministrator(principal); await this.index.sync(); }
  async summary(principal: AuthenticatedPrincipal) { await this.ready(principal); return this.index.summary(); }
  async transactions(principal: AuthenticatedPrincipal, input: Parameters<ChainActivityIndex['listTransactions']>[0]) { await this.ready(principal); return { ...this.index.listTransactions(input), summary: this.index.summary() }; }
  async users(principal: AuthenticatedPrincipal, input: Parameters<ChainActivityIndex['listUsers']>[0]) { await this.ready(principal); return { ...this.index.listUsers(input), summary: this.index.summary() }; }
}
