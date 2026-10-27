import { paginateLeaderboardCandidates, type LeaderboardCandidate } from './gameplay-verifier.js';
import type { PrismaClient } from './generated/prisma/client.js';

export type LeaderboardScope = 'today' | 'week' | 'all';

export interface LeaderboardRow extends LeaderboardCandidate {
  displayName: string | null;
}

export interface LeaderboardRepository {
  findVerified(input: { scope: LeaderboardScope; gameMode?: string }): Promise<LeaderboardRow[]>;
}

export class PrismaLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly database: Pick<PrismaClient, 'scoreRecord'>) {}

  async findVerified(input: { scope: LeaderboardScope; gameMode?: string }): Promise<LeaderboardRow[]> {
    const start = scopeStart(input.scope, new Date());
    const rows = await this.database.scoreRecord.findMany({
      where: {
        status: 'VERIFIED',
        invalidatedAt: null,
        ...(start ? { createdAt: { gte: start } } : {}),
        ...(input.gameMode ? { session: { gameMode: input.gameMode } } : {}),
      },
      select: {
        id: true,
        playerId: true,
        score: true,
        createdAt: true,
        player: { select: { displayName: true } },
      },
    });
    return rows.map(row => ({
      scoreId: row.id,
      playerId: row.playerId,
      displayName: row.player.displayName,
      score: row.score,
      tieBreakerAt: row.createdAt,
    }));
  }
}

export interface LeaderboardResult {
  items: Array<LeaderboardRow & { rank: number }>;
  nextCursor: number | null;
}

function scopeStart(scope: LeaderboardScope, now: Date): Date | undefined {
  if (scope === 'all') return undefined;
  const start = new Date(now);
  if (scope === 'today') start.setUTCHours(0, 0, 0, 0);
  else {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
  }
  return start;
}

export class LeaderboardService {
  constructor(private readonly repository: LeaderboardRepository, private readonly now = () => new Date()) {}

  async list(input: { scope: LeaderboardScope; gameMode?: string; limit: number; cursor?: number }): Promise<LeaderboardResult> {
    const rows = await this.repository.findVerified(input);
    const start = scopeStart(input.scope, this.now());
    const filtered = start ? rows.filter(row => row.tieBreakerAt >= start) : rows;
    const ranked = paginateLeaderboardCandidates(filtered, input.limit, input.cursor ?? 0);
    return {
      items: ranked.items.map(item => ({
        ...item,
        displayName: rows.find(row => row.scoreId === item.scoreId)?.displayName ?? null,
      })),
      nextCursor: ranked.nextCursor,
    };
  }
}
