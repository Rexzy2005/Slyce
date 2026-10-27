import { z } from 'zod';

const uuid = z.string().uuid();
const nonEmptyString = (max: number) => z.string().trim().min(1).max(max);

export const apiVersion = 'v1' as const;
export const apiPrefix = `/api/${apiVersion}` as const;

export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const paginationSchema = z.object({
  nextCursor: z.string().min(1).nullable(),
  limit: z.number().int().min(1).max(100),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: nonEmptyString(80),
    message: nonEmptyString(500),
    requestId: nonEmptyString(100).optional(),
    fields: z.record(z.string(), z.array(nonEmptyString(300))).optional(),
  }),
});

export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({
  data,
  requestId: nonEmptyString(100).optional(),
});

export const sessionResponseSchema = z.union([
  z.object({ status: z.literal('anonymous') }),
  z.object({
    status: z.literal('authenticated'),
    kind: z.enum(['player', 'administrator']),
    subject: nonEmptyString(255),
    playerId: uuid.optional(),
    email: z.string().email().optional(),
  }),
]);

export const playerProfileSchema = z.object({
  id: uuid,
  displayName: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  wallets: z.array(z.object({
    id: uuid,
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.number().int().positive(),
    status: z.enum(['ACTIVE', 'REVOKED']),
    verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'DISPUTED']),
  })),
  goodDollarVerification: z.object({
    state: z.enum(['UNKNOWN', 'VERIFIED', 'UNVERIFIED', 'UNAVAILABLE']),
    lastSuccessfulCheckAt: z.string().datetime().nullable(),
    lastAttemptedCheckAt: z.string().datetime().nullable(),
  }).nullable(),
});

export const adminPlayerListItemSchema = playerProfileSchema.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const adminPlayerListResponseSchema = z.object({
  data: z.array(adminPlayerListItemSchema),
  pagination: paginationSchema,
});

export const leaderboardQuerySchema = paginationQuerySchema.extend({
  cursor: z.string().regex(/^\d+$/).optional(),
  scope: z.enum(['today', 'week', 'all']),
  gameMode: z.string().trim().min(1).max(40).optional(),
});

export const leaderboardItemSchema = z.object({
  scoreId: uuid,
  playerId: uuid,
  displayName: z.string().nullable(),
  score: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
});

export const leaderboardResponseSchema = z.object({
  data: z.array(leaderboardItemSchema),
  pagination: paginationSchema,
});

export const gameModeSchema = z.string().trim().min(1).max(40);
export const rulesVersionSchema = z.string().trim().min(1).max(80);
export const inputDigestSchema = z.string().regex(/^[0-9a-f]{64}$/i);
export const replayInputSchema = z.object({
  kind: z.literal('pointer'),
  phase: z.enum(['down', 'move', 'up']),
  elapsedMs: z.number().int().min(0).max(30_000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const createGameSessionSchema = z.object({
  gameMode: gameModeSchema,
  rulesVersion: rulesVersionSchema,
});

export const gameSessionSchema = z.object({
  id: uuid,
  gameMode: gameModeSchema,
  status: z.enum(['CREATED', 'STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ABANDONED']),
  rulesVersion: rulesVersionSchema,
  seed: z.string().min(1).max(128),
  expiresAt: z.string().datetime(),
});

export const finishGameSessionSchema = z.object({
  inputDigest: inputDigestSchema,
  score: z.number().int().nonnegative().max(1_000_000),
  breakdown: z.record(z.string(), z.number().int().nonnegative()).optional(),
  replayInputs: z.array(replayInputSchema).max(10_000).optional(),
});

export const scoreSubmissionResultSchema = z.union([
  z.object({ status: z.enum(['accepted', 'verified']), scoreId: uuid, score: z.number().int().nonnegative(), verificationStatus: z.enum(['PENDING', 'VERIFIED']) }),
  z.object({ status: z.literal('rejected'), reason: nonEmptyString(500) }),
]);

export const goodDollarVerificationCheckSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export const walletChallengeRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int().positive(),
  origin: z.string().url(),
});

export const walletChallengeResponseSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int().positive(),
  nonce: z.string().min(20),
  message: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const walletVerifyRequestSchema = walletChallengeRequestSchema.extend({
  nonce: z.string().min(20),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

export const walletVerifyResponseSchema = z.object({
  token: z.string().min(1),
  playerId: uuid,
});

export const goodDollarVerificationSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  state: z.enum(['VERIFIED', 'UNVERIFIED', 'UNAVAILABLE']),
  rootIdentityReference: z.string().regex(/^0x[0-9a-fA-F]{40}$/).nullable(),
  lastAuthenticatedAt: z.string().datetime().nullable(),
});

export const goodDollarVerificationCountSchema = z.object({
  environment: z.enum(['production', 'staging', 'development']),
  verifiedCount: z.number().int().nonnegative(),
});

export const idempotencyKeySchema = z.string().trim().regex(/^\S+$/, 'Idempotency-Key must not contain whitespace.').min(16).max(255);

export const routeGroups = {
  health: '/healthz',
  readiness: '/readyz',
  session: `${apiPrefix}/session`,
  players: `${apiPrefix}/players`,
  gameplay: `${apiPrefix}/gameplay`,
  leaderboards: `${apiPrefix}/leaderboards`,
  challenges: `${apiPrefix}/challenges`,
  bounties: `${apiPrefix}/bounties`,
  rewards: `${apiPrefix}/rewards`,
  admin: `${apiPrefix}/admin`,
} as const;

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
