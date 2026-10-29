import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal } from './security.js';
import { requireAdministrator } from './security.js';
import { isWithinActiveWindow } from './active-window.js';

export type BountyStatusType = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export type BountyParticipationStatusType = 'ACTIVE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DISQUALIFIED' | 'EXPIRED';
export type SubmissionReviewStatusType = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BountyView {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: BountyStatusType;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  maxParticipants: number | null;
  rewardAsset: string;
  rewardAmount: string;
  leaderboardMode: string | null;
  requirements: Record<string, unknown>;
  participationsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BountyParticipationView {
  id: string;
  playerId: string;
  bountyId: string;
  bountySlug: string;
  bountyTitle: string;
  versionId: string;
  status: BountyParticipationStatusType;
  joinedAt: string;
  completedAt: string | null;
  submissions: BountySubmissionView[];
}

export interface BountySubmissionView {
  id: string;
  participationId: string;
  status: SubmissionReviewStatusType;
  evidence: Record<string, unknown>;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface BountyLeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string | null;
  participationId: string;
  joinedAt: string;
  completedAt: string | null;
  status: BountyParticipationStatusType;
}

export interface CreateBountyInput {
  slug: string;
  title: string;
  description: string;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  maxParticipants?: number | null | undefined;
  rewardAsset?: string | undefined;
  rewardAmount: string;
  leaderboardMode?: string | null | undefined;
  requirements?: Record<string, unknown> | undefined;
}

export interface UpdateBountyInput {
  title?: string | undefined;
  description?: string | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  maxParticipants?: number | null | undefined;
  leaderboardMode?: string | null | undefined;
  requirements?: Record<string, unknown> | undefined;
}

export interface SubmitBountyEvidenceInput {
  evidence: Record<string, unknown>;
}

export interface ReviewSubmissionInput {
  status: 'APPROVED' | 'REJECTED';
  reviewNotes?: string | undefined;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface BountyRepository {
  create(input: CreateBountyInput): Promise<BountyView>;
  update(id: string, input: UpdateBountyInput): Promise<BountyView>;
  findById(id: string): Promise<BountyView | null>;
  findBySlug(slug: string): Promise<BountyView | null>;
  list(opts: { cursor?: string | undefined; limit: number; status?: BountyStatusType | undefined }): Promise<{ items: BountyView[]; nextCursor: string | null }>;
  transition(id: string, to: BountyStatusType): Promise<BountyView>;
  findParticipation(bountyId: string, playerId: string): Promise<BountyParticipationView | null>;
  findParticipationById(id: string): Promise<BountyParticipationView | null>;
  listPlayerParticipations(playerId: string): Promise<BountyParticipationView[]>;
  join(bountyId: string, playerId: string): Promise<BountyParticipationView>;
  submitEvidence(participationId: string, input: SubmitBountyEvidenceInput): Promise<BountySubmissionView>;
  reviewSubmission(submissionId: string, adminId: string, input: ReviewSubmissionInput): Promise<BountySubmissionView>;
  leaderboard(bountyId: string, opts: { limit: number; cursor?: string | undefined }): Promise<{ items: BountyLeaderboardEntry[]; nextCursor: string | null }>;
}

// ---------------------------------------------------------------------------
// Valid lifecycle transitions
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<BountyStatusType, BountyStatusType[]> = {
  DRAFT: ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  SCHEDULED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  PUBLISHED: ['PAUSED', 'CLOSED', 'ARCHIVED'],
  PAUSED: ['PUBLISHED', 'CLOSED', 'ARCHIVED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

function assertTransitionAllowed(from: BountyStatusType, to: BountyStatusType): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: cannot move bounty from ${from} to ${to}.`);
  }
}

// ---------------------------------------------------------------------------
// Prisma Repository
// ---------------------------------------------------------------------------

function rowToView(row: {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  maxParticipants: number | null;
  rewardAsset: string;
  rewardAmount: { toString(): string };
  leaderboardMode: string | null;
  requirements: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  _count?: { participations: number };
}): BountyView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status as BountyStatusType,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    maxParticipants: row.maxParticipants ?? null,
    rewardAsset: row.rewardAsset,
    rewardAmount: row.rewardAmount.toString(),
    leaderboardMode: row.leaderboardMode ?? null,
    requirements: row.requirements as Record<string, unknown>,
    ...(row._count ? { participationsCount: row._count.participations } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function participationToView(
  row: {
    id: string;
    playerId: string;
    bountyId: string;
    status: string;
    joinedAt: Date;
    completedAt: Date | null;
    versionId: string;
    bounty: { slug: string; title: string };
    submissions: Array<{
      id: string;
      participationId: string;
      status: string;
      evidence: Prisma.JsonValue;
      reviewNotes: string | null;
      submittedAt: Date;
      reviewedAt: Date | null;
    }>;
  },
): BountyParticipationView {
  return {
    id: row.id,
    playerId: row.playerId,
    bountyId: row.bountyId,
    bountySlug: row.bounty.slug,
    bountyTitle: row.bounty.title,
    versionId: row.versionId,
    status: row.status as BountyParticipationStatusType,
    joinedAt: row.joinedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    submissions: row.submissions.map(s => ({
      id: s.id,
      participationId: s.participationId,
      status: s.status as SubmissionReviewStatusType,
      evidence: s.evidence as Record<string, unknown>,
      reviewNotes: s.reviewNotes,
      submittedAt: s.submittedAt.toISOString(),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
    })),
  };
}

const PARTICIPATION_INCLUDE = {
  bounty: { select: { slug: true, title: true } },
  submissions: {
    orderBy: { submittedAt: 'asc' as const },
  },
};

export class PrismaBountyRepository implements BountyRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateBountyInput): Promise<BountyView> {
    const row = await this.db.$transaction(async (tx) => {
      const bounty = await tx.bounty.create({
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
          ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
          maxParticipants: input.maxParticipants ?? null,
          rewardAsset: input.rewardAsset ?? 'G$',
          rewardAmount: new Prisma.Decimal(input.rewardAmount),
          leaderboardMode: input.leaderboardMode ?? null,
          requirements: (input.requirements ?? {}) as Prisma.JsonObject,
          versions: {
            create: {
              version: 1,
              requirements: (input.requirements ?? {}) as Prisma.JsonObject,
            },
          },
        },
        include: { _count: { select: { participations: true } } },
      });
      return bounty;
    });
    return rowToView(row);
  }

  async update(id: string, input: UpdateBountyInput): Promise<BountyView> {
    const row = await this.db.bounty.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
        ...(input.maxParticipants !== undefined ? { maxParticipants: input.maxParticipants } : {}),
        ...(input.leaderboardMode !== undefined ? { leaderboardMode: input.leaderboardMode } : {}),
        ...(input.requirements !== undefined ? { requirements: input.requirements as Prisma.JsonObject } : {}),
      },
      include: { _count: { select: { participations: true } } },
    });
    return rowToView(row);
  }

  async findById(id: string): Promise<BountyView | null> {
    const row = await this.db.bounty.findUnique({
      where: { id },
      include: { _count: { select: { participations: true } } },
    });
    return row ? rowToView(row) : null;
  }

  async findBySlug(slug: string): Promise<BountyView | null> {
    const row = await this.db.bounty.findUnique({
      where: { slug },
      include: { _count: { select: { participations: true } } },
    });
    return row ? rowToView(row) : null;
  }

  async list(opts: { cursor?: string | undefined; limit: number; status?: BountyStatusType | undefined }): Promise<{ items: BountyView[]; nextCursor: string | null }> {
    const now = new Date();
    const rows = await this.db.bounty.findMany({
      ...(opts.status ? { where: {
        status: opts.status,
        ...(opts.status === 'PUBLISHED' ? {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        } : {}),
      } } : {}),
      include: { _count: { select: { participations: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    return { items: items.map(rowToView), nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  async transition(id: string, to: BountyStatusType): Promise<BountyView> {
    const row = await this.db.$transaction(async (tx) => {
      const existing = await tx.bounty.findUniqueOrThrow({ where: { id } });
      assertTransitionAllowed(existing.status as BountyStatusType, to);
      const now = new Date();
      return tx.bounty.update({
        where: { id },
        data: {
          status: to,
          ...(to === 'PUBLISHED' && !existing.publishedAt ? { publishedAt: now } : {}),
          ...(to === 'CLOSED' ? { closedAt: now } : {}),
          ...(to === 'ARCHIVED' ? { archivedAt: now } : {}),
        },
        include: { _count: { select: { participations: true } } },
      });
    });
    return rowToView(row);
  }

  async findParticipation(bountyId: string, playerId: string): Promise<BountyParticipationView | null> {
    // Find the latest participation for this player+bounty
    const row = await this.db.bountyParticipation.findFirst({
      where: { bountyId, playerId },
      orderBy: { joinedAt: 'desc' },
      include: PARTICIPATION_INCLUDE,
    });
    return row ? participationToView(row) : null;
  }

  async findParticipationById(id: string): Promise<BountyParticipationView | null> {
    const row = await this.db.bountyParticipation.findUnique({
      where: { id },
      include: PARTICIPATION_INCLUDE,
    });
    return row ? participationToView(row) : null;
  }

  async listPlayerParticipations(playerId: string): Promise<BountyParticipationView[]> {
    const rows = await this.db.bountyParticipation.findMany({
      where: { playerId },
      orderBy: { joinedAt: 'desc' },
      include: PARTICIPATION_INCLUDE,
    });
    return rows.map(participationToView);
  }

  async join(bountyId: string, playerId: string): Promise<BountyParticipationView> {
    const row = await this.db.$transaction(async (tx) => {
      const bounty = await tx.bounty.findUniqueOrThrow({
        where: { id: bountyId },
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
          _count: { select: { participations: true } },
        },
      });
      if (bounty.status !== 'PUBLISHED') throw new Error('This bounty is not currently open for participation.');
      if (!isWithinActiveWindow(bounty.startsAt, bounty.endsAt, new Date())) {
        throw new Error('This bounty is not currently open for participation.');
      }
      if (bounty.maxParticipants !== null && bounty._count.participations >= bounty.maxParticipants) {
        throw new Error('This bounty has reached its maximum participant limit.');
      }
      const latestVersion = bounty.versions[0];
      if (!latestVersion) throw new Error('Bounty has no published version.');
      // Check for existing active participation
      const existing = await tx.bountyParticipation.findFirst({
        where: { playerId, bountyId, status: 'ACTIVE' },
      });
      if (existing) throw new Error('You are already participating in this bounty.');
      return tx.bountyParticipation.create({
        data: {
          playerId,
          bountyId,
          versionId: latestVersion.id,
        },
        include: PARTICIPATION_INCLUDE,
      });
    });
    return participationToView(row);
  }

  async submitEvidence(participationId: string, input: SubmitBountyEvidenceInput): Promise<BountySubmissionView> {
    const row = await this.db.$transaction(async (tx) => {
      const participation = await tx.bountyParticipation.findUniqueOrThrow({ where: { id: participationId } });
      if (participation.status !== 'ACTIVE') throw new Error('Evidence can only be submitted for an active participation.');
      const submission = await tx.bountySubmission.create({
        data: {
          participationId,
          evidence: input.evidence as Prisma.JsonObject,
        },
      });
      // Mark participation as SUBMITTED
      await tx.bountyParticipation.update({
        where: { id: participationId },
        data: { status: 'SUBMITTED' },
      });
      return submission;
    });
    return {
      id: row.id,
      participationId: row.participationId,
      status: row.status as SubmissionReviewStatusType,
      evidence: row.evidence as Record<string, unknown>,
      reviewNotes: row.reviewNotes,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  async reviewSubmission(submissionId: string, adminSubject: string, input: ReviewSubmissionInput): Promise<BountySubmissionView> {
    const row = await this.db.$transaction(async (tx) => {
      const admin = await tx.adminAccount.findUniqueOrThrow({ where: { externalSubject: adminSubject } });
      const submission = await tx.bountySubmission.findUniqueOrThrow({
        where: { id: submissionId },
        include: { participation: true },
      });
      if (submission.status !== 'PENDING') throw new Error('This submission has already been reviewed.');
      const claim = await tx.bountySubmission.updateMany({
        where: { id: submissionId, status: 'PENDING' },
        data: {
          status: input.status,
          reviewNotes: input.reviewNotes ?? null,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      if (claim.count !== 1) throw new Error('This submission has already been reviewed.');
      const reviewedSubmission = await tx.bountySubmission.findUniqueOrThrow({ where: { id: submissionId } });
      // Update participation status
      const participationUpdate = input.status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      const now = new Date();
      await tx.bountyParticipation.update({
        where: { id: submission.participationId },
        data: {
          status: participationUpdate,
          ...(input.status === 'APPROVED' ? { completedAt: now } : {}),
        },
      });
      // Create reward eligibility record if approved
      if (input.status === 'APPROVED') {
        const bounty = await tx.bounty.findUniqueOrThrow({ where: { id: submission.participation.bountyId } });
        await tx.reward.create({
          data: {
            playerId: submission.participation.playerId,
            sourceType: 'BOUNTY',
            bountyId: submission.participation.bountyId,
            bountyParticipationId: submission.participationId,
            asset: bounty.rewardAsset,
            amount: bounty.rewardAmount,
            eligibilityEvidence: { submissionId, reviewedById: admin.id, reviewedAt: now.toISOString() } as Prisma.JsonObject,
          },
        });
      }
      return reviewedSubmission;
    });
    return {
      id: row.id,
      participationId: row.participationId,
      status: row.status as SubmissionReviewStatusType,
      evidence: row.evidence as Record<string, unknown>,
      reviewNotes: row.reviewNotes,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  async leaderboard(bountyId: string, opts: { limit: number; cursor?: string | undefined }): Promise<{ items: BountyLeaderboardEntry[]; nextCursor: string | null }> {
    // Only completed, approved participations are eligible. Rank is global, not page-relative.
    let rankOffset = 0;
    if (opts.cursor) {
      const cursorRow = await this.db.bountyParticipation.findFirst({
        where: { id: opts.cursor, bountyId, status: 'APPROVED', completedAt: { not: null } },
        select: { id: true, completedAt: true, joinedAt: true },
      });
      if (!cursorRow?.completedAt) throw new Error('The bounty leaderboard cursor is invalid.');
      rankOffset = await this.db.bountyParticipation.count({
        where: {
          bountyId,
          status: 'APPROVED',
          completedAt: { not: null },
          OR: [
            { completedAt: { lt: cursorRow.completedAt } },
            { completedAt: cursorRow.completedAt, joinedAt: { lt: cursorRow.joinedAt } },
            { completedAt: cursorRow.completedAt, joinedAt: cursorRow.joinedAt, id: { lte: cursorRow.id } },
          ],
        },
      });
    }
    const rows = await this.db.bountyParticipation.findMany({
      where: {
        bountyId,
        status: 'APPROVED',
        completedAt: { not: null },
      },
      include: { player: { select: { displayName: true } } },
      orderBy: [
        { completedAt: 'asc' },
        { joinedAt: 'asc' },
        { id: 'asc' },
      ],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    return {
      items: items.map((row, index) => ({
        rank: rankOffset + index + 1,
        playerId: row.playerId,
        displayName: row.player.displayName,
        participationId: row.id,
        joinedAt: row.joinedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        status: row.status as BountyParticipationStatusType,
      })),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BountyService {
  constructor(private readonly repository: BountyRepository) {}

  async createBounty(principal: AuthenticatedPrincipal, input: CreateBountyInput): Promise<BountyView> {
    requireAdministrator(principal);
    return this.repository.create(input);
  }

  async updateBounty(principal: AuthenticatedPrincipal, id: string, input: UpdateBountyInput): Promise<BountyView> {
    requireAdministrator(principal);
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('Bounty not found.');
    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new Error('Only DRAFT or SCHEDULED bounties can be edited.');
    }
    return this.repository.update(id, input);
  }

  async getBounty(id: string): Promise<BountyView> {
    const bounty = await this.repository.findById(id);
    if (!bounty) throw new Error('Bounty not found.');
    return bounty;
  }

  async listBounties(principal: AuthenticatedPrincipal, opts: { cursor?: string | undefined; limit: number }): Promise<{ items: BountyView[]; nextCursor: string | null }> {
    requireAdministrator(principal);
    return this.repository.list(opts);
  }

  async listPublishedBounties(opts: { cursor?: string | undefined; limit: number }): Promise<{ items: BountyView[]; nextCursor: string | null }> {
    return this.repository.list({ ...opts, status: 'PUBLISHED' });
  }

  async publishBounty(principal: AuthenticatedPrincipal, id: string): Promise<BountyView> {
    requireAdministrator(principal);
    return this.repository.transition(id, 'PUBLISHED');
  }

  async pauseBounty(principal: AuthenticatedPrincipal, id: string): Promise<BountyView> {
    requireAdministrator(principal);
    return this.repository.transition(id, 'PAUSED');
  }

  async closeBounty(principal: AuthenticatedPrincipal, id: string): Promise<BountyView> {
    requireAdministrator(principal);
    return this.repository.transition(id, 'CLOSED');
  }

  async archiveBounty(principal: AuthenticatedPrincipal, id: string): Promise<BountyView> {
    requireAdministrator(principal);
    return this.repository.transition(id, 'ARCHIVED');
  }

  async joinBounty(principal: AuthenticatedPrincipal, bountyId: string): Promise<BountyParticipationView> {
    if (!principal.playerId) throw new Error('A player account is required to join a bounty.');
    return this.repository.join(bountyId, principal.playerId);
  }

  async submitEvidence(principal: AuthenticatedPrincipal, participationId: string, input: SubmitBountyEvidenceInput): Promise<BountySubmissionView> {
    if (!principal.playerId) throw new Error('A player account is required to submit evidence.');
    const participation = await this.repository.findParticipationById(participationId);
    if (!participation) throw new Error('Participation not found.');
    if (participation.playerId !== principal.playerId) throw new Error('This participation does not belong to the authenticated player.');
    if (participation.bountyId === undefined) throw new Error('Invalid participation record.');
    return this.repository.submitEvidence(participationId, input);
  }

  async reviewSubmission(principal: AuthenticatedPrincipal, submissionId: string, input: ReviewSubmissionInput): Promise<BountySubmissionView> {
    requireAdministrator(principal);
    return this.repository.reviewSubmission(submissionId, principal.subject, input);
  }

  async getPlayerParticipations(principal: AuthenticatedPrincipal): Promise<BountyParticipationView[]> {
    if (!principal.playerId) throw new Error('A player account is required.');
    return this.repository.listPlayerParticipations(principal.playerId);
  }

  async getBountyLeaderboard(bountyId: string, opts: { limit: number; cursor?: string | undefined }): Promise<{ items: BountyLeaderboardEntry[]; nextCursor: string | null }> {
    const bounty = await this.repository.findById(bountyId);
    if (!bounty) throw new Error('Bounty not found.');
    if (bounty.status === 'DRAFT') throw new Error('Leaderboard is not available for draft bounties.');
    return this.repository.leaderboard(bountyId, opts);
  }
}
