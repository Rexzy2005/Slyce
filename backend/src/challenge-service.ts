import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal } from './security.js';
import { requireAdministrator } from './security.js';
import { isWithinActiveWindow } from './active-window.js';

export type ChallengeStatusType = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type ParticipationStatusType = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DISQUALIFIED' | 'EXPIRED';

export interface ChallengeRuleView {
  id: string;
  position: number;
  eventType: string;
  operator: string;
  counter: string;
  threshold: number;
  configuration: Record<string, unknown>;
}

export interface ChallengeVersionView {
  id: string;
  version: number;
  status: ChallengeStatusType;
  rulesVersion: string;
  rewardAsset: string;
  rewardAmount: string;
  rules: ChallengeRuleView[];
  createdAt: string;
  publishedAt: string | null;
}

export interface ChallengeView {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ChallengeStatusType;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  currentVersion: ChallengeVersionView | null;
  participationsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeParticipationView {
  id: string;
  challengeId: string;
  challengeSlug: string;
  challengeTitle: string;
  versionId: string;
  versionNumber: number;
  status: ParticipationStatusType;
  progress: Record<string, number>;
  rules: ChallengeRuleView[];
  rewardAsset: string;
  rewardAmount: string;
  enrolledAt: string;
  completedAt: string | null;
}

export interface CreateChallengeInput {
  slug: string;
  title: string;
  description: string;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  rulesVersion?: string | undefined;
  rewardAsset?: string | undefined;
  rewardAmount: string;
  rules: Array<{
    eventType: string;
    operator: string;
    counter: string;
    threshold: number;
    configuration?: Record<string, unknown> | undefined;
  }>;
}

export interface UpdateChallengeInput {
  title?: string | undefined;
  description?: string | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
}

export interface GameplayEventData {
  targetsCut: number;
  bestCombo: number;
  bombsCut: number;
  score: number;
  roundCompleted: boolean;
}

export function evaluateRuleCondition(
  rule: { operator: string; counter: string; threshold: number },
  progress: Record<string, number>,
): boolean {
  const current = progress[rule.counter] ?? 0;
  switch (rule.operator) {
    case 'gte':
      return current >= rule.threshold;
    case 'lte':
      return current <= rule.threshold;
    case 'eq':
      return current === rule.threshold;
    default:
      return false;
  }
}

export function updateParticipationProgress(
  current: Record<string, number>,
  event: GameplayEventData,
): Record<string, number> {
  return {
    ...current,
    targets_cut: (current.targets_cut ?? 0) + event.targetsCut,
    best_combo: Math.max(current.best_combo ?? 0, event.bestCombo),
    rounds_completed: (current.rounds_completed ?? 0) + (event.roundCompleted ? 1 : 0),
    score: (current.score ?? 0) + event.score,
    clean_rounds: (current.clean_rounds ?? 0) + (event.bombsCut === 0 && event.roundCompleted ? 1 : 0),
  };
}

export function isChallengeComplete(
  rules: Array<{ operator: string; counter: string; threshold: number }>,
  progress: Record<string, number>,
): boolean {
  return rules.length > 0 && rules.every(rule => evaluateRuleCondition(rule, progress));
}

function mapRule(rule: {
  id: string;
  position: number;
  eventType: string;
  operator: string;
  counter: string | null;
  threshold: Prisma.Decimal | null;
  configuration: unknown;
}): ChallengeRuleView {
  return {
    id: rule.id,
    position: rule.position,
    eventType: rule.eventType,
    operator: rule.operator,
    counter: rule.counter ?? '',
    threshold: rule.threshold ? Number(rule.threshold) : 0,
    configuration: (rule.configuration ?? {}) as Record<string, unknown>,
  };
}

function mapVersion(version: {
  id: string;
  version: number;
  status: ChallengeStatusType;
  rulesVersion: string;
  rewardAsset: string;
  rewardAmount: Prisma.Decimal;
  rules?: Array<{
    id: string;
    position: number;
    eventType: string;
    operator: string;
    counter: string | null;
    threshold: Prisma.Decimal | null;
    configuration: unknown;
  }>;
  createdAt: Date;
  publishedAt: Date | null;
}): ChallengeVersionView {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    rulesVersion: version.rulesVersion,
    rewardAsset: version.rewardAsset,
    rewardAmount: version.rewardAmount.toString(),
    rules: (version.rules ?? []).map(mapRule),
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
  };
}

function mapChallenge(challenge: {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ChallengeStatusType;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  versions?: Array<Parameters<typeof mapVersion>[0]>;
  _count?: { participations: number };
  createdAt: Date;
  updatedAt: Date;
}): ChallengeView {
  const latestVersion = challenge.versions?.[0] ? mapVersion(challenge.versions[0]) : null;
  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    description: challenge.description,
    status: challenge.status,
    startsAt: challenge.startsAt?.toISOString() ?? null,
    endsAt: challenge.endsAt?.toISOString() ?? null,
    publishedAt: challenge.publishedAt?.toISOString() ?? null,
    archivedAt: challenge.archivedAt?.toISOString() ?? null,
    currentVersion: latestVersion,
    ...(challenge._count ? { participationsCount: challenge._count.participations } : {}),
    createdAt: challenge.createdAt.toISOString(),
    updatedAt: challenge.updatedAt.toISOString(),
  };
}

export interface ChallengeRepository {
  create(input: CreateChallengeInput): Promise<ChallengeView>;
  update(id: string, input: UpdateChallengeInput): Promise<ChallengeView>;
  publish(id: string): Promise<ChallengeView>;
  pause(id: string): Promise<ChallengeView>;
  archive(id: string): Promise<ChallengeView>;
  getById(id: string): Promise<ChallengeView | null>;
  getBySlug(slug: string): Promise<ChallengeView | null>;
  listAdmin(input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }>;
  listPublished(input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }>;
  join(playerId: string, challengeId: string): Promise<ChallengeParticipationView>;
  listPlayerParticipations(playerId: string): Promise<ChallengeParticipationView[]>;
  evaluateGameplayEvents(playerId: string, event: GameplayEventData): Promise<Array<{
    participationId: string;
    challengeTitle: string;
    completed: boolean;
    rewardCreated: boolean;
  }>>;
}

export class PrismaChallengeRepository implements ChallengeRepository {
  constructor(private readonly database: PrismaClient) {}

  private async withSerializableRetry<T>(operation: Parameters<PrismaClient['$transaction']>[0]): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.database.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }) as T;
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt === 3) throw error;
      }
    }
    throw new Error('Serializable challenge transaction exhausted its retry budget.');
  }

  async create(input: CreateChallengeInput): Promise<ChallengeView> {
    const challenge = await this.database.challenge.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        status: 'DRAFT',
        versions: {
          create: {
            version: 1,
            status: 'DRAFT',
            rulesVersion: input.rulesVersion ?? 'verified-fruit-slice-v1',
            rewardAsset: input.rewardAsset ?? 'G$',
            rewardAmount: new Prisma.Decimal(input.rewardAmount),
            rules: {
              create: input.rules.map((rule, index) => ({
                position: index,
                eventType: rule.eventType,
                operator: rule.operator,
                counter: rule.counter,
                threshold: new Prisma.Decimal(rule.threshold),
                configuration: (rule.configuration ?? {}) as Prisma.InputJsonValue,
              })),
            },
          },
        },
      },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return mapChallenge(challenge as Parameters<typeof mapChallenge>[0]);
  }

  async update(id: string, input: UpdateChallengeInput): Promise<ChallengeView> {
    const challenge = await this.database.challenge.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return mapChallenge(challenge as Parameters<typeof mapChallenge>[0]);
  }

  async publish(id: string): Promise<ChallengeView> {
    const now = new Date();
    const challenge = await this.database.challenge.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!challenge) throw new Error('Challenge not found.');
    if (challenge.status === 'ARCHIVED') throw new Error('Cannot publish an archived challenge.');

    const updated = await this.database.$transaction(async tx => {
      if (challenge.versions[0]) {
        await tx.challengeVersion.update({
          where: { id: challenge.versions[0].id },
          data: { status: 'PUBLISHED', publishedAt: now },
        });
      }
      return tx.challenge.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: now },
        include: {
          versions: {
            include: { rules: { orderBy: { position: 'asc' } } },
            orderBy: { version: 'desc' },
          },
          _count: { select: { participations: true } },
        },
      });
    });
    return mapChallenge(updated as Parameters<typeof mapChallenge>[0]);
  }

  async pause(id: string): Promise<ChallengeView> {
    const updated = await this.database.challenge.update({
      where: { id },
      data: { status: 'PAUSED' },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return mapChallenge(updated as Parameters<typeof mapChallenge>[0]);
  }

  async archive(id: string): Promise<ChallengeView> {
    const updated = await this.database.challenge.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return mapChallenge(updated as Parameters<typeof mapChallenge>[0]);
  }

  async getById(id: string): Promise<ChallengeView | null> {
    const challenge = await this.database.challenge.findUnique({
      where: { id },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return challenge ? mapChallenge(challenge as Parameters<typeof mapChallenge>[0]) : null;
  }

  async getBySlug(slug: string): Promise<ChallengeView | null> {
    const challenge = await this.database.challenge.findUnique({
      where: { slug },
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    return challenge ? mapChallenge(challenge as Parameters<typeof mapChallenge>[0]) : null;
  }

  async listAdmin(input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }> {
    const rows = await this.database.challenge.findMany({
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        versions: {
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
        _count: { select: { participations: true } },
      },
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(row => mapChallenge(row as Parameters<typeof mapChallenge>[0]));
    return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }

  async listPublished(input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }> {
    const now = new Date();
    const rows = await this.database.challenge.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
        },
      },
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(row => mapChallenge(row as Parameters<typeof mapChallenge>[0]));
    return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }

  async join(playerId: string, challengeId: string): Promise<ChallengeParticipationView> {
    const challenge = await this.database.challenge.findUnique({
      where: { id: challengeId },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          include: { rules: { orderBy: { position: 'asc' } } },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!challenge || challenge.status !== 'PUBLISHED' || !isWithinActiveWindow(challenge.startsAt, challenge.endsAt, new Date())) {
      throw new Error('This challenge is not currently active for participation.');
    }
    const version = challenge.versions[0];
    if (!version) throw new Error('No published version found for this challenge.');

    const existing = await this.database.challengeParticipation.findFirst({
      where: { playerId, challengeId, versionId: version.id, attemptNumber: 1 },
      include: {
        challenge: true,
        version: { include: { rules: { orderBy: { position: 'asc' } } } },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        challengeId: existing.challengeId,
        challengeSlug: existing.challenge.slug,
        challengeTitle: existing.challenge.title,
        versionId: existing.versionId,
        versionNumber: existing.version.version,
        status: existing.status,
        progress: (existing.progress ?? {}) as Record<string, number>,
        rules: existing.version.rules.map(mapRule),
        rewardAsset: existing.version.rewardAsset,
        rewardAmount: existing.version.rewardAmount.toString(),
        enrolledAt: existing.enrolledAt.toISOString(),
        completedAt: existing.completedAt?.toISOString() ?? null,
      };
    }

    const created = await this.database.challengeParticipation.create({
      data: {
        playerId,
        challengeId,
        versionId: version.id,
        attemptNumber: 1,
        status: 'ACTIVE',
        progress: { targets_cut: 0, best_combo: 0, rounds_completed: 0, score: 0, clean_rounds: 0 },
      },
      include: {
        challenge: true,
        version: { include: { rules: { orderBy: { position: 'asc' } } } },
      },
    });

    return {
      id: created.id,
      challengeId: created.challengeId,
      challengeSlug: created.challenge.slug,
      challengeTitle: created.challenge.title,
      versionId: created.versionId,
      versionNumber: created.version.version,
      status: created.status,
      progress: (created.progress ?? {}) as Record<string, number>,
      rules: created.version.rules.map(mapRule),
      rewardAsset: created.version.rewardAsset,
      rewardAmount: created.version.rewardAmount.toString(),
      enrolledAt: created.enrolledAt.toISOString(),
      completedAt: created.completedAt?.toISOString() ?? null,
    };
  }

  async listPlayerParticipations(playerId: string): Promise<ChallengeParticipationView[]> {
    const rows = await this.database.challengeParticipation.findMany({
      where: { playerId },
      include: {
        challenge: true,
        version: { include: { rules: { orderBy: { position: 'asc' } } } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
    return rows.map(row => ({
      id: row.id,
      challengeId: row.challengeId,
      challengeSlug: row.challenge.slug,
      challengeTitle: row.challenge.title,
      versionId: row.versionId,
      versionNumber: row.version.version,
      status: row.status,
      progress: (row.progress ?? {}) as Record<string, number>,
      rules: row.version.rules.map(mapRule),
      rewardAsset: row.version.rewardAsset,
      rewardAmount: row.version.rewardAmount.toString(),
      enrolledAt: row.enrolledAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async evaluateGameplayEvents(playerId: string, event: GameplayEventData): Promise<Array<{
    participationId: string;
    challengeTitle: string;
    completed: boolean;
    rewardCreated: boolean;
  }>> {
    const activeParticipations = await this.database.challengeParticipation.findMany({
      where: { playerId, status: 'ACTIVE' },
      include: {
        challenge: true,
        version: { include: { rules: { orderBy: { position: 'asc' } } } },
      },
    });

    const results: Array<{
      participationId: string;
      challengeTitle: string;
      completed: boolean;
      rewardCreated: boolean;
    }> = [];

    for (const participation of activeParticipations) {
      const result = await this.withSerializableRetry<{
        participationId: string;
        challengeTitle: string;
        completed: boolean;
        rewardCreated: boolean;
      } | null>(async tx => {
        const current = await tx.challengeParticipation.findUnique({
          where: { id: participation.id },
          include: {
            challenge: true,
            version: { include: { rules: { orderBy: { position: 'asc' } } } },
          },
        });
        const evaluatedAt = new Date();
        if (!current || current.status !== 'ACTIVE' || current.challenge.status !== 'PUBLISHED'
          || !isWithinActiveWindow(current.challenge.startsAt, current.challenge.endsAt, evaluatedAt)) return null;

        const nextProgress = updateParticipationProgress((current.progress ?? {}) as Record<string, number>, event);
        const complete = isChallengeComplete(current.version.rules.map(rule => ({
          operator: rule.operator,
          counter: rule.counter ?? '',
          threshold: rule.threshold ? Number(rule.threshold) : 0,
        })), nextProgress);

        await tx.challengeParticipation.update({
          where: { id: current.id },
          data: {
            progress: nextProgress,
            ...(complete ? { status: 'COMPLETED', completedAt: evaluatedAt } : {}),
          },
        });
        if (complete) {
          await tx.reward.create({
            data: {
              playerId,
              sourceType: 'CHALLENGE',
              challengeId: current.challengeId,
              challengeParticipationId: current.id,
              asset: current.version.rewardAsset,
              amount: current.version.rewardAmount,
              status: 'ELIGIBLE',
              eligibilityEvidence: {
                completedAt: evaluatedAt.toISOString(),
                progress: nextProgress,
                rulesVersion: current.version.rulesVersion,
              },
            },
          });
        }
        return {
          participationId: current.id,
          challengeTitle: current.challenge.title,
          completed: complete,
          rewardCreated: complete,
        };
      });
      if (result) results.push(result);
    }

    return results;
  }
}

export class ChallengeService {
  constructor(private readonly repository: ChallengeRepository) {}

  async createChallenge(principal: AuthenticatedPrincipal, input: CreateChallengeInput): Promise<ChallengeView> {
    requireAdministrator(principal);
    return this.repository.create(input);
  }

  async updateChallenge(principal: AuthenticatedPrincipal, id: string, input: UpdateChallengeInput): Promise<ChallengeView> {
    requireAdministrator(principal);
    return this.repository.update(id, input);
  }

  async publishChallenge(principal: AuthenticatedPrincipal, id: string): Promise<ChallengeView> {
    requireAdministrator(principal);
    return this.repository.publish(id);
  }

  async pauseChallenge(principal: AuthenticatedPrincipal, id: string): Promise<ChallengeView> {
    requireAdministrator(principal);
    return this.repository.pause(id);
  }

  async archiveChallenge(principal: AuthenticatedPrincipal, id: string): Promise<ChallengeView> {
    requireAdministrator(principal);
    return this.repository.archive(id);
  }

  async listAdminChallenges(principal: AuthenticatedPrincipal, input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }> {
    requireAdministrator(principal);
    return this.repository.listAdmin(input);
  }

  async getAdminChallenge(principal: AuthenticatedPrincipal, id: string): Promise<ChallengeView | null> {
    requireAdministrator(principal);
    return this.repository.getById(id);
  }

  listPublishedChallenges(input: { cursor?: string | undefined; limit: number }): Promise<{ items: ChallengeView[]; nextCursor: string | null }> {
    return this.repository.listPublished(input);
  }

  getPublishedChallenge(idOrSlug: string): Promise<ChallengeView | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    return isUuid ? this.repository.getById(idOrSlug) : this.repository.getBySlug(idOrSlug);
  }

  async joinChallenge(playerId: string, challengeId: string): Promise<ChallengeParticipationView> {
    return this.repository.join(playerId, challengeId);
  }

  async listPlayerParticipations(playerId: string): Promise<ChallengeParticipationView[]> {
    return this.repository.listPlayerParticipations(playerId);
  }

  async evaluateGameplay(playerId: string, event: GameplayEventData): Promise<Array<{
    participationId: string;
    challengeTitle: string;
    completed: boolean;
    rewardCreated: boolean;
  }>> {
    return this.repository.evaluateGameplayEvents(playerId, event);
  }
}
