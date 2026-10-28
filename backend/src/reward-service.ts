import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal } from './security.js';
import { requireAdministrator, requireAdminRole } from './security.js';

export type RewardStatusType = 'ELIGIBLE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISTRIBUTION_PENDING' | 'DISTRIBUTION_FAILED' | 'DISTRIBUTED' | 'COMPLETED';
export type DistributionStatusType = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

export interface RewardDistributionView {
  id: string;
  status: DistributionStatusType;
  transactionReference: string | null;
  evidence: Record<string, unknown> | null;
  failureReason: string | null;
  attemptedAt: string;
  confirmedAt: string | null;
}

export interface RewardView {
  id: string;
  playerId: string;
  sourceType: 'CHALLENGE' | 'BOUNTY';
  challengeId: string | null;
  bountyId: string | null;
  asset: string;
  amount: string;
  status: RewardStatusType;
  eligibilityEvidence: Record<string, unknown>;
  rejectionReason: string | null;
  eligibleAt: string;
  createdAt: string;
  updatedAt: string;
  distributions: RewardDistributionView[];
}

export interface ReviewRewardInput {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string | undefined;
}

export interface RecordDistributionInput {
  status: DistributionStatusType;
  transactionReference?: string | undefined;
  evidence?: Record<string, unknown> | undefined;
  failureReason?: string | undefined;
}

export interface RewardRepository {
  list(input: { playerId?: string | undefined; status?: RewardStatusType | undefined; cursor?: string | undefined; limit: number }): Promise<{ items: RewardView[]; nextCursor: string | null }>;
  review(rewardId: string, adminSubject: string, input: ReviewRewardInput): Promise<RewardView>;
  recordDistribution(rewardId: string, adminSubject: string, input: RecordDistributionInput): Promise<RewardView>;
}

const rewardInclude = {
  distributions: { orderBy: { attemptedAt: 'desc' as const } },
} as const;

function mapReward(row: {
  id: string; playerId: string; sourceType: 'CHALLENGE' | 'BOUNTY'; challengeId: string | null; bountyId: string | null;
  asset: string; amount: Prisma.Decimal; status: RewardStatusType; eligibilityEvidence: unknown; rejectionReason: string | null;
  eligibleAt: Date; createdAt: Date; updatedAt: Date;
  distributions: Array<{ id: string; status: DistributionStatusType; transactionReference: string | null; evidence: unknown; failureReason: string | null; attemptedAt: Date; confirmedAt: Date | null }>;
}): RewardView {
  return {
    id: row.id,
    playerId: row.playerId,
    sourceType: row.sourceType,
    challengeId: row.challengeId,
    bountyId: row.bountyId,
    asset: row.asset,
    amount: row.amount.toString(),
    status: row.status,
    eligibilityEvidence: row.eligibilityEvidence as Record<string, unknown>,
    rejectionReason: row.rejectionReason,
    eligibleAt: row.eligibleAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    distributions: row.distributions.map(distribution => ({
      id: distribution.id,
      status: distribution.status,
      transactionReference: distribution.transactionReference,
      evidence: distribution.evidence as Record<string, unknown> | null,
      failureReason: distribution.failureReason,
      attemptedAt: distribution.attemptedAt.toISOString(),
      confirmedAt: distribution.confirmedAt?.toISOString() ?? null,
    })),
  };
}

export class PrismaRewardRepository implements RewardRepository {
  constructor(private readonly database: PrismaClient) {}

  async list(input: { playerId?: string | undefined; status?: RewardStatusType | undefined; cursor?: string | undefined; limit: number }): Promise<{ items: RewardView[]; nextCursor: string | null }> {
    const rows = await this.database.reward.findMany({
      where: { ...(input.playerId ? { playerId: input.playerId } : {}), ...(input.status ? { status: input.status } : {}) },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: rewardInclude,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(row => mapReward(row as Parameters<typeof mapReward>[0]));
    return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }

  async review(rewardId: string, adminSubject: string, input: ReviewRewardInput): Promise<RewardView> {
    return this.database.$transaction(async tx => {
      const admin = await tx.adminAccount.findUniqueOrThrow({ where: { externalSubject: adminSubject } });
      const reward = await tx.reward.findUniqueOrThrow({ where: { id: rewardId }, include: rewardInclude });
      if (reward.status !== 'ELIGIBLE' && reward.status !== 'PENDING_REVIEW') throw new Error('This reward has already been reviewed.');
      if (input.decision === 'REJECTED' && !input.reason) throw new Error('A rejection reason is required.');
      const updated = await tx.reward.update({
        where: { id: rewardId },
        data: { status: input.decision, rejectionReason: input.decision === 'REJECTED' ? (input.reason ?? null) : null },
        include: rewardInclude,
      });
      await tx.rewardApproval.create({ data: { rewardId, adminId: admin.id, status: input.decision, reason: input.reason ?? null } });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: input.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
          entityType: 'Reward', entityId: rewardId,
          before: { status: reward.status } as Prisma.JsonObject,
          after: { status: input.decision } as Prisma.JsonObject,
          reason: input.reason ?? null,
        },
      });
      return mapReward(updated as unknown as Parameters<typeof mapReward>[0]);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordDistribution(rewardId: string, adminSubject: string, input: RecordDistributionInput): Promise<RewardView> {
    return this.database.$transaction(async tx => {
      const admin = await tx.adminAccount.findUniqueOrThrow({ where: { externalSubject: adminSubject } });
      const reward = await tx.reward.findUniqueOrThrow({ where: { id: rewardId }, include: rewardInclude });
      if (!['APPROVED', 'DISTRIBUTION_PENDING', 'DISTRIBUTION_FAILED'].includes(reward.status)) throw new Error('Only an approved reward can be distributed.');
      if (reward.distributions.some(item => item.status === 'CONFIRMED')) throw new Error('This reward already has a confirmed distribution.');
      if (reward.distributions.some(item => item.status === 'PENDING' || item.status === 'SUBMITTED')) throw new Error('This reward already has an active distribution attempt.');
      if (input.status === 'CONFIRMED' && !input.transactionReference && !input.evidence) throw new Error('Confirmed distribution requires transaction reference or evidence.');
      if (input.status === 'FAILED' && !input.failureReason) throw new Error('A failure reason is required.');
      const rewardStatus: RewardStatusType = input.status === 'CONFIRMED' ? 'DISTRIBUTED' : input.status === 'FAILED' ? 'DISTRIBUTION_FAILED' : 'DISTRIBUTION_PENDING';
      await tx.rewardDistribution.create({
        data: {
          rewardId, attemptedById: admin.id, status: input.status,
          transactionReference: input.transactionReference ?? null,
          ...(input.evidence !== undefined ? { evidence: input.evidence as Prisma.InputJsonValue } : {}),
          failureReason: input.failureReason ?? null,
          confirmedAt: input.status === 'CONFIRMED' ? new Date() : null,
        },
      });
      const updated = await tx.reward.update({ where: { id: rewardId }, data: { status: rewardStatus }, include: rewardInclude });
      await tx.auditLog.create({
        data: {
          adminId: admin.id, action: 'DISTRIBUTE', entityType: 'Reward', entityId: rewardId,
          before: { status: reward.status } as Prisma.JsonObject,
          after: { status: rewardStatus, distributionStatus: input.status, transactionReference: input.transactionReference ?? null } as Prisma.JsonObject,
          reason: input.failureReason ?? null,
        },
      });
      return mapReward(updated as Parameters<typeof mapReward>[0]);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export class RewardService {
  constructor(private readonly repository: RewardRepository) {}

  listForPlayer(principal: AuthenticatedPrincipal, input: { status?: RewardStatusType | undefined; cursor?: string | undefined; limit: number }) {
    if (!principal.playerId) throw new Error('A player account is required.');
    return this.repository.list({ ...input, playerId: principal.playerId });
  }

  listForAdmin(principal: AuthenticatedPrincipal, input: { status?: RewardStatusType | undefined; cursor?: string | undefined; limit: number }) {
    requireAdministrator(principal);
    return this.repository.list(input);
  }

  review(principal: AuthenticatedPrincipal, rewardId: string, input: ReviewRewardInput) {
    requireAdminRole(principal, 'reviewer');
    return this.repository.review(rewardId, principal.subject, input);
  }

  recordDistribution(principal: AuthenticatedPrincipal, rewardId: string, input: RecordDistributionInput) {
    requireAdminRole(principal, 'admin');
    return this.repository.recordDistribution(rewardId, principal.subject, input);
  }
}
