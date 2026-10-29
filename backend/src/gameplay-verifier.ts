import { createHash } from 'node:crypto';
import type { ScoreSubmission } from './gameplay-service.js';
import { PrismaClient, Prisma } from './generated/prisma/client.js';
import { replayInputSchema } from './api/contracts.js';
import {
  canonicalReplayInputs,
  simulateVerifiedFruitSlice,
  verifiedFruitSliceGameMode,
  verifiedFruitSliceRulesVersion,
  type ReplayInput,
} from '@slyyce/shared/verified-game';

export interface VerificationContext {
  readonly sessionId: string;
  readonly playerId: string;
  readonly gameMode: string;
  readonly rulesVersion: string;
  readonly seed: string;
}

export type VerificationResult =
  | { status: 'verified'; score: number; breakdown?: Record<string, number> }
  | { status: 'rejected'; reason: string };

/**
 * The backend accepts this interface as the only authority capable of promoting
 * a pending score. The current practice runtime intentionally has no implementation.
 */
export interface DeterministicGameplayVerifier {
  verify(context: VerificationContext, submission: ScoreSubmission): Promise<VerificationResult>;
}

export class VerifiedFruitSliceVerifier implements DeterministicGameplayVerifier {
  async verify(context: VerificationContext, submission: ScoreSubmission): Promise<VerificationResult> {
    if (context.gameMode !== verifiedFruitSliceGameMode || context.rulesVersion !== verifiedFruitSliceRulesVersion) {
      return { status: 'rejected', reason: 'The submitted ruleset is not supported by this verifier.' };
    }
    if (!submission.replayInputs) return { status: 'rejected', reason: 'Replay inputs are required for verified gameplay.' };
    const expectedDigest = digestReplayInputs(submission.replayInputs);
    if (submission.inputDigest !== expectedDigest) return { status: 'rejected', reason: 'Replay input digest does not match the submitted inputs.' };
    try {
      const result = simulateVerifiedFruitSlice(context.seed, submission.replayInputs);
      if (result.score !== submission.score) return { status: 'rejected', reason: 'Submitted score does not match the deterministic replay result.' };
      return {
        status: 'verified',
        score: result.score,
        breakdown: { targetsCut: result.targetsCut, bombsCut: result.bombsCut, bestCombo: result.bestCombo },
      };
    } catch (error) {
      return { status: 'rejected', reason: error instanceof Error ? error.message : 'Replay could not be verified.' };
    }
  }
}

export function digestReplayInputs(inputs: readonly ReplayInput[]): string {
  return createHash('sha256').update(canonicalReplayInputs(inputs), 'utf8').digest('hex');
}

export interface PendingScoreStore {
  claimPending(scoreId: string): Promise<{
    id: string;
    playerId: string;
    score: number;
    inputDigest: string;
    replayInputs: unknown;
    context: VerificationContext;
  } | null>;
  markVerified(scoreId: string, result: Extract<VerificationResult, { status: 'verified' }>): Promise<void>;
  markRejected(scoreId: string, reason: string): Promise<void>;
}

export class ScoreVerificationService {
  constructor(private readonly store: PendingScoreStore, private readonly verifier: DeterministicGameplayVerifier) {}

  async verifyPending(scoreId: string): Promise<VerificationResult> {
    const pending = await this.store.claimPending(scoreId);
    if (!pending) return { status: 'rejected', reason: 'The score is not pending or does not exist.' };
    const parsedInputs = replayInputSchema.array().safeParse(pending.replayInputs);
    if (!parsedInputs.success) {
      await this.store.markRejected(scoreId, 'Replay inputs are invalid.');
      return { status: 'rejected', reason: 'Replay inputs are invalid.' };
    }
    const result = await this.verifier.verify(pending.context, {
      inputDigest: pending.inputDigest,
      score: pending.score,
      replayInputs: parsedInputs.data,
    });
    if (result.status === 'verified') await this.store.markVerified(scoreId, result);
    else await this.store.markRejected(scoreId, result.reason);
    return result;
  }
}

export class PrismaPendingScoreStore implements PendingScoreStore {
  constructor(private readonly database: PrismaClient) {}

  async claimPending(scoreId: string): Promise<Awaited<ReturnType<PendingScoreStore['claimPending']>>> {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claimed = await this.database.scoreRecord.updateMany({
      where: {
        id: scoreId,
        OR: [
          { status: 'PENDING' },
          { status: 'VERIFYING', updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: 'VERIFYING' },
    });
    if (claimed.count !== 1) return null;
    const row = await this.database.scoreRecord.findUnique({
      where: { id: scoreId },
      select: {
        id: true,
        playerId: true,
        score: true,
        inputDigest: true,
        replayInputs: true,
        status: true,
        rulesVersion: true,
        session: { select: { id: true, playerId: true, gameMode: true, rulesVersion: true, seed: true } },
      },
    });
    if (!row || row.status !== 'VERIFYING' || !row.replayInputs) return null;
    return {
      id: row.id,
      playerId: row.playerId,
      score: row.score,
      inputDigest: row.inputDigest,
      replayInputs: row.replayInputs,
      context: {
        sessionId: row.session.id,
        playerId: row.playerId,
        gameMode: row.session.gameMode,
        rulesVersion: row.rulesVersion,
        seed: row.session.seed,
      },
    };
  }

  async markVerified(scoreId: string, result: Extract<VerificationResult, { status: 'verified' }>): Promise<void> {
    await this.database.$transaction(async transaction => {
      const current = await transaction.scoreRecord.findUnique({ where: { id: scoreId }, select: { status: true, sessionId: true } });
      if (!current || current.status !== 'VERIFYING') return;
      await transaction.scoreRecord.update({
        where: { id: scoreId },
        data: {
          status: 'VERIFIED',
          score: result.score,
          verifiedAt: new Date(),
          ...(result.breakdown ? { breakdown: result.breakdown as Prisma.InputJsonValue } : {}),
        },
      });
      await transaction.gameSession.update({ where: { id: current.sessionId }, data: { status: 'VERIFIED', endedAt: new Date() } });
    });
  }

  async markRejected(scoreId: string, reason: string): Promise<void> {
    await this.database.$transaction(async transaction => {
      const current = await transaction.scoreRecord.findUnique({ where: { id: scoreId }, select: { status: true, sessionId: true } });
      if (!current || current.status !== 'VERIFYING') return;
      await transaction.scoreRecord.update({ where: { id: scoreId }, data: { status: 'REJECTED', rejectionReason: reason } });
      await transaction.gameSession.update({ where: { id: current.sessionId }, data: { status: 'REJECTED', endedAt: new Date() } });
    });
  }
}

export interface LeaderboardCandidate {
  readonly scoreId: string;
  readonly playerId: string;
  readonly score: number;
  readonly tieBreakerAt: Date;
}

export function compareLeaderboardCandidates(left: LeaderboardCandidate, right: LeaderboardCandidate): number {
  if (left.score !== right.score) return right.score - left.score;
  const timestampOrder = left.tieBreakerAt.getTime() - right.tieBreakerAt.getTime();
  if (timestampOrder !== 0) return timestampOrder;
  return left.scoreId.localeCompare(right.scoreId);
}

export function rankLeaderboardCandidates(candidates: readonly LeaderboardCandidate[]): Array<LeaderboardCandidate & { rank: number }> {
  return [...candidates]
    .sort(compareLeaderboardCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function paginateLeaderboardCandidates(
  candidates: readonly LeaderboardCandidate[],
  limit: number,
  cursor = 0,
): { items: Array<LeaderboardCandidate & { rank: number }>; nextCursor: number | null } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Leaderboard limit must be between 1 and 100.');
  if (!Number.isInteger(cursor) || cursor < 0) throw new Error('Leaderboard cursor must be a non-negative integer.');
  const ranked = rankLeaderboardCandidates(candidates);
  const items = ranked.slice(cursor, cursor + limit);
  return { items, nextCursor: cursor + items.length < ranked.length ? cursor + items.length : null };
}
