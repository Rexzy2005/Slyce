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

export interface PlayerRecordRepository {
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

export class PrismaPlayerRecordRepository implements PlayerRecordRepository {
  constructor(private readonly database: Pick<PrismaClient, 'player'>) {}

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
}
