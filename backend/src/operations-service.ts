import type { AuditAction, PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal } from './security.js';
import { requireAdministrator } from './security.js';

export interface OperationalMetrics {
  generatedAt: string;
  players: { total: number; active: number };
  goodDollar: { verifiedRootIdentities: number };
  gameplay: { activeSessions: number; verifiedScores: number };
  content: { publishedChallenges: number; publishedBounties: number };
  rewards: { pendingReview: number; approved: number; distributionPending: number; distributed: number; failed: number };
  health: { database: 'reachable' };
}

export interface AuditLogView {
  id: string; action: string; entityType: string; entityId: string; reason: string | null;
  createdAt: string; administrator: { email: string | null; displayName: string | null };
}

export interface OperationsRepository {
  ping(): Promise<void>;
  metrics(environment: string): Promise<OperationalMetrics>;
  auditLogs(input: { cursor?: string | undefined; limit: number; action?: AuditAction | undefined; entityType?: string | undefined; search?: string | undefined }): Promise<{ items: AuditLogView[]; nextCursor: string | null }>;
}

export class PrismaOperationsRepository implements OperationsRepository {
  constructor(private readonly database: PrismaClient) {}
  async ping(): Promise<void> { await this.database.$queryRaw`SELECT 1`; }

  async metrics(environment: string): Promise<OperationalMetrics> {
    const [total, active, roots, activeSessions, verifiedScores, challenges, bounties, rewardGroups] = await Promise.all([
      this.database.player.count(), this.database.player.count({ where: { status: 'ACTIVE' } }),
      this.database.goodDollarVerificationRecord.findMany({ where: { environment, state: 'VERIFIED', rootIdentityReference: { not: null } }, select: { rootIdentityReference: true } }),
      this.database.gameSession.count({ where: { status: { in: ['CREATED', 'STARTED'] }, expiresAt: { gt: new Date() } } }),
      this.database.scoreRecord.count({ where: { status: 'VERIFIED' } }),
      this.database.challenge.count({ where: { status: 'PUBLISHED' } }), this.database.bounty.count({ where: { status: 'PUBLISHED' } }),
      this.database.reward.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const rewards = Object.fromEntries(rewardGroups.map(row => [row.status, row._count._all]));
    return {
      generatedAt: new Date().toISOString(), players: { total, active },
      goodDollar: { verifiedRootIdentities: new Set(roots.map(row => row.rootIdentityReference?.toLowerCase()).filter(Boolean)).size },
      gameplay: { activeSessions, verifiedScores }, content: { publishedChallenges: challenges, publishedBounties: bounties },
      rewards: { pendingReview: (rewards.ELIGIBLE ?? 0) + (rewards.PENDING_REVIEW ?? 0), approved: rewards.APPROVED ?? 0, distributionPending: rewards.DISTRIBUTION_PENDING ?? 0, distributed: (rewards.DISTRIBUTED ?? 0) + (rewards.COMPLETED ?? 0), failed: rewards.DISTRIBUTION_FAILED ?? 0 },
      health: { database: 'reachable' },
    };
  }

  async auditLogs(input: { cursor?: string | undefined; limit: number; action?: AuditAction | undefined; entityType?: string | undefined; search?: string | undefined }) {
    const rows = await this.database.auditLog.findMany({
      where: { ...(input.action ? { action: input.action } : {}), ...(input.entityType ? { entityType: input.entityType } : {}), ...(input.search ? { OR: [{ entityId: { contains: input.search, mode: 'insensitive' } }, { reason: { contains: input.search, mode: 'insensitive' } }] } : {}) },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), take: input.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { admin: { select: { email: true, displayName: true } } },
    });
    const hasNext = rows.length > input.limit;
    const selected = rows.slice(0, input.limit);
    return { items: selected.map(row => ({ id: row.id, action: row.action, entityType: row.entityType, entityId: row.entityId, reason: row.reason, createdAt: row.createdAt.toISOString(), administrator: row.admin })), nextCursor: hasNext ? selected.at(-1)?.id ?? null : null };
  }
}

export class OperationsService {
  constructor(private readonly repository: OperationsRepository, private readonly environment: string) {}
  ping() { return this.repository.ping(); }
  metrics(principal: AuthenticatedPrincipal) { requireAdministrator(principal); return this.repository.metrics(this.environment); }
  auditLogs(principal: AuthenticatedPrincipal, input: { cursor?: string | undefined; limit: number; action?: AuditAction | undefined; entityType?: string | undefined; search?: string | undefined }) { requireAdministrator(principal); return this.repository.auditLogs(input); }
}
