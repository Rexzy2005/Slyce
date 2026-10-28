import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthenticatedPrincipal } from './security.js';
import { PrismaClient, Prisma } from './generated/prisma/client.js';
import type { ReplayInput } from '@slyce/shared';
import { verifiedFruitSliceGameMode, verifiedFruitSliceRulesVersion } from '@slyce/shared/verified-game';

export interface SessionDescriptor {
  id: string;
  playerId: string;
  gameMode: string;
  status: 'CREATED';
  rulesVersion: string;
  seed: string;
  expiresAt: Date;
}

export interface ScoreSubmission {
  inputDigest: string;
  score: number;
  breakdown?: Record<string, number>;
  replayInputs?: readonly ReplayInput[];
}

export interface GameplayRules {
  readonly gameMode: string;
  readonly rulesVersion: string;
  createSeed(): string;
  validateSubmission(submission: ScoreSubmission): string | null;
}

export interface GameplaySessionRepository {
  create(session: SessionDescriptor): Promise<void>;
  findOwned(id: string, playerId: string): Promise<SessionDescriptor | null>;
  submitOwnedScore(args: {
    session: SessionDescriptor;
    playerId: string;
    submission: ScoreSubmission;
    operation: string;
    idempotencyKey: string;
  }): Promise<ScoreSubmissionResult>;
}

export type ScoreSubmissionResult =
  | { status: 'accepted'; scoreId: string; score: number; verificationStatus: 'PENDING' }
  | { status: 'verified'; scoreId: string; score: number; verificationStatus: 'VERIFIED' }
  | { status: 'rejected'; reason: string };

export function digestInput(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function createPracticeSafeRules(gameMode: string, rulesVersion: string): GameplayRules {
  return {
    gameMode,
    rulesVersion,
    createSeed: () => randomBytes(32).toString('hex'),
    validateSubmission: submission => {
      if (!Number.isSafeInteger(submission.score) || submission.score < 0 || submission.score > 1_000_000) return 'Score is outside the supported range.';
      if (!/^[0-9a-f]{64}$/i.test(submission.inputDigest)) return 'Input digest is invalid.';
      if (submission.breakdown && Object.values(submission.breakdown).some(value => !Number.isSafeInteger(value) || value < 0)) return 'Score breakdown is invalid.';
      if (submission.replayInputs && submission.replayInputs.length > 10_000) return 'Replay input count is outside the supported range.';
      return null;
    },
  };
}

export function createVerifiedFruitSliceRules(): GameplayRules {
  return {
    gameMode: verifiedFruitSliceGameMode,
    rulesVersion: verifiedFruitSliceRulesVersion,
    createSeed: () => randomBytes(32).toString('hex'),
    validateSubmission: submission => {
      const baseError = createPracticeSafeRules(verifiedFruitSliceGameMode, verifiedFruitSliceRulesVersion).validateSubmission(submission);
      if (baseError) return baseError;
      if (!submission.replayInputs) return 'Replay inputs are required for verified gameplay.';
      return null;
    },
  };
}

export class GameplayService {
  constructor(private readonly repository: GameplaySessionRepository) {}

  async createSession(principal: AuthenticatedPrincipal, rules: GameplayRules, ttlMs = 15 * 60_000): Promise<SessionDescriptor> {
    if (principal.kind !== 'player' || !principal.playerId) throw new Error('Authenticated player access is required.');
    const session: SessionDescriptor = {
      id: randomUUID(),
      playerId: principal.playerId,
      gameMode: rules.gameMode,
      status: 'CREATED',
      rulesVersion: rules.rulesVersion,
      seed: rules.createSeed(),
      expiresAt: new Date(Date.now() + ttlMs),
    };
    await this.repository.create(session);
    return session;
  }

  async validateOwnedSubmission(principal: AuthenticatedPrincipal, sessionId: string, rules: GameplayRules, submission: ScoreSubmission): Promise<string | null> {
    if (principal.kind !== 'player' || !principal.playerId) throw new Error('Authenticated player access is required.');
    const session = await this.repository.findOwned(sessionId, principal.playerId);
    if (!session) return 'Gameplay session was not found.';
    if (session.status !== 'CREATED') return 'Gameplay session is no longer accepting a submission.';
    if (session.expiresAt <= new Date()) return 'Gameplay session has expired.';
    if (session.rulesVersion !== rules.rulesVersion) return 'Gameplay rules version does not match the session.';
    return rules.validateSubmission(submission);
  }

  async submitScore(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    rules: GameplayRules,
    submission: ScoreSubmission,
    idempotencyKey: string,
  ): Promise<ScoreSubmissionResult> {
    if (principal.kind !== 'player' || !principal.playerId) throw new Error('Authenticated player access is required.');
    const session = await this.repository.findOwned(sessionId, principal.playerId);
    if (!session) return { status: 'rejected', reason: 'Gameplay session was not found.' };
    if (session.status !== 'CREATED') return { status: 'rejected', reason: 'Gameplay session is no longer accepting a submission.' };
    if (session.expiresAt <= new Date()) return { status: 'rejected', reason: 'Gameplay session has expired.' };
    if (session.rulesVersion !== rules.rulesVersion) return { status: 'rejected', reason: 'Gameplay rules version does not match the session.' };
    const validationError = rules.validateSubmission(submission);
    if (validationError) return { status: 'rejected', reason: validationError };
    return this.repository.submitOwnedScore({ session, playerId: principal.playerId, submission, operation: `gameplay:submit:${session.id}`, idempotencyKey });
  }
}

interface GameplayDatabase {
  gameSession: {
    create(args: { data: Prisma.GameSessionUncheckedCreateInput }): Promise<unknown>;
    findFirst(args: { where: { id: string; playerId: string }; select: {
      id: true; playerId: true; gameMode: true; status: true; rulesVersion: true; seed: true; expiresAt: true;
    } }): Promise<{
      id: string; playerId: string; gameMode: string; status: SessionDescriptor['status']; rulesVersion: string; seed: string; expiresAt: Date;
    } | null>;
    update(args: { where: { id: string }; data: { status: 'SUBMITTED'; submittedAt: Date } }): Promise<unknown>;
  };
  scoreRecord: {
    create(args: { data: Prisma.ScoreRecordUncheckedCreateInput }): Promise<{ id: string; score: number }>;
  };
  idempotencyKey: {
    findUnique(args: { where: { key_operation: { key: string; operation: string } } }): Promise<{ status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'; response: unknown } | null>;
    create(args: { data: Prisma.IdempotencyKeyUncheckedCreateInput }): Promise<unknown>;
    update(args: { where: { key_operation: { key: string; operation: string } }; data: { status: 'COMPLETED'; response: Prisma.InputJsonValue; completedAt: Date } }): Promise<unknown>;
  };
}

export class PrismaGameplaySessionRepository implements GameplaySessionRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(session: SessionDescriptor): Promise<void> {
    await this.database.gameSession.create({
      data: {
        id: session.id,
        playerId: session.playerId,
        gameMode: session.gameMode,
        status: 'CREATED',
        rulesVersion: session.rulesVersion,
        seed: session.seed,
        expiresAt: session.expiresAt,
      },
    });
  }

  async findOwned(id: string, playerId: string): Promise<SessionDescriptor | null> {
    return this.database.gameSession.findFirst({
      where: { id, playerId },
      select: { id: true, playerId: true, gameMode: true, status: true, rulesVersion: true, seed: true, expiresAt: true },
    }) as Promise<SessionDescriptor | null>;
  }

  async submitOwnedScore(args: {
    session: SessionDescriptor;
    playerId: string;
    submission: ScoreSubmission;
    operation: string;
    idempotencyKey: string;
  }): Promise<ScoreSubmissionResult> {
    const existing = await this.database.idempotencyKey.findUnique({
      where: { key_operation: { key: args.idempotencyKey, operation: args.operation } },
    });
    if (existing?.status === 'COMPLETED' && existing.response && typeof existing.response === 'object' && 'status' in existing.response) {
      const response = existing.response as ScoreSubmissionResult;
      if (response.status === 'accepted') {
        const score = await this.database.scoreRecord.findUnique({ where: { id: response.scoreId }, select: { status: true, score: true, rejectionReason: true } });
        if (score?.status === 'VERIFIED') return { status: 'verified', scoreId: response.scoreId, score: score.score, verificationStatus: 'VERIFIED' };
        if (score?.status === 'REJECTED' || score?.status === 'INVALIDATED') return { status: 'rejected', reason: score.rejectionReason ?? 'The score was rejected.' };
      }
      return response;
    }

    try {
      await this.database.idempotencyKey.create({
        data: {
          key: args.idempotencyKey,
          playerId: args.playerId,
          operation: args.operation,
          status: 'IN_PROGRESS',
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const retry = await this.database.idempotencyKey.findUnique({
        where: { key_operation: { key: args.idempotencyKey, operation: args.operation } },
      });
      if (retry?.status === 'COMPLETED' && retry.response && typeof retry.response === 'object' && 'status' in retry.response) {
        return retry.response as ScoreSubmissionResult;
      }
      return { status: 'rejected', reason: 'The score submission is already being processed.' };
    }

    const score = await this.database.$transaction(async transaction => {
      const created = await transaction.scoreRecord.create({
        data: {
          sessionId: args.session.id,
          playerId: args.playerId,
          score: args.submission.score,
          status: 'PENDING',
          rulesVersion: args.session.rulesVersion,
          inputDigest: args.submission.inputDigest,
          ...(args.submission.replayInputs ? { replayInputs: JSON.parse(JSON.stringify(args.submission.replayInputs)) as Prisma.InputJsonValue } : {}),
          ...(args.submission.breakdown ? { breakdown: args.submission.breakdown } : {}),
        },
      });
      await transaction.gameSession.update({
        where: { id: args.session.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      return { status: 'accepted' as const, scoreId: created.id, score: created.score, verificationStatus: 'PENDING' as const };
    });
    await this.database.idempotencyKey.update({
      where: { key_operation: { key: args.idempotencyKey, operation: args.operation } },
      data: { status: 'COMPLETED', response: score, completedAt: new Date() },
    });
    return score;
  }
}
