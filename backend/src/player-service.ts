import type { PrincipalStore } from './principal-store.js';
import type { PrismaClient } from './generated/prisma/client.js';

export interface PlayerProfile {
  id: string;
  displayName: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  wallets: Array<{
    id: string;
    address: string;
    chainId: number;
    status: 'ACTIVE' | 'REVOKED';
    verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED';
    signInMethod?: string | null;
  }>;
  goodDollarVerification: {
    state: 'UNKNOWN' | 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
    lastSuccessfulCheckAt: string | null;
    lastAttemptedCheckAt: string | null;
  } | null;
}

export interface AdminPlayerListItem extends PlayerProfile {
  createdAt: string;
  updatedAt: string;
}

export interface PlayerGrowth {
  total: number;
  last24h: number;
  last7d: number;
  last30d: number;
  byMethod: { email: number; social: number; wallet: number; unknown: number };
  /** One row per UTC day, oldest first; `total` is the running count of sign-ups at the end of that day. */
  daily: Array<{ date: string; signUps: number; total: number }>;
}

export interface PlayerRecordRepository {
  growth(days: number, now?: Date): Promise<PlayerGrowth>;
  findById(id: string): Promise<AdminPlayerListItem | null>;
  list(input: { cursor?: string | undefined; limit: number }): Promise<{ items: AdminPlayerListItem[]; nextCursor: string | null }>;
}

type PlayerWithRelations = {
  id: string;
  displayName: string | null;
  status: PlayerProfile['status'];
  createdAt: Date;
  updatedAt: Date;
  wallets: PlayerProfile['wallets'];
  goodDollarVerification: {
    state: 'UNKNOWN' | 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
    lastSuccessfulCheckAt: Date | null;
    lastAttemptedCheckAt: Date | null;
  } | null;
};

function mapPlayer(player: PlayerWithRelations): AdminPlayerListItem {
  return {
    id: player.id,
    displayName: player.displayName,
    status: player.status,
    wallets: player.wallets,
    goodDollarVerification: player.goodDollarVerification ? {
      state: player.goodDollarVerification.state,
      lastSuccessfulCheckAt: player.goodDollarVerification.lastSuccessfulCheckAt?.toISOString() ?? null,
      lastAttemptedCheckAt: player.goodDollarVerification.lastAttemptedCheckAt?.toISOString() ?? null,
    } : null,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
  };
}

const dayMs = 86_400_000;

/** Builds the daily series from per-day counts; days without sign-ups are filled with zero. */
export function buildDailyGrowth(rows: ReadonlyArray<{ day: string; count: number }>, totalBefore: number, days: number, now: Date): PlayerGrowth['daily'] {
  const counts = new Map(rows.map(row => [row.day, row.count]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let total = totalBefore;
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today - (days - 1 - i) * dayMs).toISOString().slice(0, 10);
    const signUps = counts.get(date) ?? 0;
    total += signUps;
    return { date, signUps, total };
  });
}

export class PrismaPlayerRecordRepository implements PlayerRecordRepository {
  constructor(private readonly database: Pick<PrismaClient, 'player' | 'wallet' | '$queryRaw'>) {}

  async growth(days: number, now = new Date()): Promise<PlayerGrowth> {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const since = new Date(today - (days - 1) * dayMs);
    const ago = (ms: number) => ({ createdAt: { gte: new Date(now.getTime() - ms) } });
    const [total, last24h, last7d, last30d, before, rows, methods] = await Promise.all([
      this.database.player.count(), this.database.player.count({ where: ago(dayMs) }), this.database.player.count({ where: ago(7 * dayMs) }), this.database.player.count({ where: ago(30 * dayMs) }),
      this.database.player.count({ where: { createdAt: { lt: since } } }),
      this.database.$queryRaw<Array<{ day: string; count: bigint }>>`SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day, count(*) AS count FROM "Player" WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.database.wallet.groupBy({ by: ['signInMethod'], _count: { _all: true } }),
    ]);
    const byMethod = { email: 0, social: 0, wallet: 0, unknown: 0 };
    for (const row of methods) {
      const key = row.signInMethod === 'email' || row.signInMethod === 'social' || row.signInMethod === 'wallet' ? row.signInMethod : 'unknown';
      byMethod[key] += row._count._all;
    }
    return { total, last24h, last7d, last30d, byMethod, daily: buildDailyGrowth(rows.map(row => ({ day: row.day, count: Number(row.count) })), before, days, now) };
  }

  async findById(id: string): Promise<AdminPlayerListItem | null> {
    const player = await this.database.player.findUnique({
      where: { id },
      include: { wallets: true, goodDollarVerification: true },
    });
    return player ? mapPlayer(player as PlayerWithRelations) : null;
  }

  async list(input: { cursor?: string | undefined; limit: number }): Promise<{ items: AdminPlayerListItem[]; nextCursor: string | null }> {
    const rows = await this.database.player.findMany({
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { wallets: true, goodDollarVerification: true },
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(row => mapPlayer(row as PlayerWithRelations));
    return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }
}

export class PlayerService {
  constructor(private readonly repository: PlayerRecordRepository, private readonly principals: PrincipalStore) {}

  async getProfile(playerId: string): Promise<PlayerProfile | null> {
    await this.principals.ensure({ subject: playerId, kind: 'player', playerId, roles: [] });
    return this.repository.findById(playerId);
  }

  listPlayers(input: { cursor?: string | undefined; limit: number }): Promise<{ items: AdminPlayerListItem[]; nextCursor: string | null }> {
    return this.repository.list(input);
  }

  growth(days: number): Promise<PlayerGrowth> {
    return this.repository.growth(days);
  }
}
