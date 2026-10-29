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

export const adminLoginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
});

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
const exactPositiveIntegerAmountSchema = z.string().regex(/^[1-9]\d{0,77}$/, 'Amount must be a positive base-10 integer with at most 78 digits');
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

export const challengeEventTypeSchema = z.enum([
  'targets_cut',
  'combo_achieved',
  'round_completed',
  'score_reached',
  'clean_round',
]);

export const challengeOperatorSchema = z.enum(['gte', 'lte', 'eq']);

export const challengeCounterSchema = z.enum([
  'targets_cut',
  'best_combo',
  'rounds_completed',
  'score',
  'clean_rounds',
]);

export const challengeRuleInputSchema = z.object({
  eventType: challengeEventTypeSchema,
  operator: challengeOperatorSchema,
  counter: challengeCounterSchema,
  threshold: z.number().int().positive(),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export const challengeRuleSchema = challengeRuleInputSchema.extend({
  id: uuid,
  position: z.number().int().nonnegative(),
});

export const createChallengeSchema = z.object({
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: nonEmptyString(160),
  description: nonEmptyString(2000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  rulesVersion: rulesVersionSchema.default('verified-fruit-slice-v1'),
  rewardAsset: z.string().trim().min(1).max(80).default('G$'),
  rewardAmount: exactPositiveIntegerAmountSchema,
  rules: z.array(challengeRuleInputSchema).min(1).max(10),
});

export const updateChallengeSchema = z.object({
  title: nonEmptyString(160).optional(),
  description: nonEmptyString(2000).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const challengeVersionSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'ARCHIVED']),
  rulesVersion: z.string(),
  rewardAsset: z.string(),
  rewardAmount: exactPositiveIntegerAmountSchema,
  rules: z.array(challengeRuleSchema),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export const challengeSchema = z.object({
  id: uuid,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'ARCHIVED']),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  currentVersion: challengeVersionSchema.nullable(),
  participationsCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const challengeListResponseSchema = z.object({
  data: z.array(challengeSchema),
  pagination: paginationSchema,
});

export const challengeParticipationSchema = z.object({
  id: uuid,
  challengeId: uuid,
  challengeSlug: z.string(),
  challengeTitle: z.string(),
  versionId: uuid,
  versionNumber: z.number().int(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'FAILED', 'DISQUALIFIED', 'EXPIRED']),
  progress: z.record(z.string(), z.number()),
  rules: z.array(challengeRuleSchema),
  rewardAsset: z.string(),
  rewardAmount: exactPositiveIntegerAmountSchema,
  enrolledAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const playerChallengeParticipationsResponseSchema = z.object({
  data: z.array(challengeParticipationSchema),
});

// ---------------------------------------------------------------------------
// Phase 9: Bounty contracts
// ---------------------------------------------------------------------------

export const bountyStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED']);
export const bountyParticipationStatusSchema = z.enum(['ACTIVE', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISQUALIFIED', 'EXPIRED']);
export const submissionReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const createBountySchema = z.object({
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: nonEmptyString(160),
  description: nonEmptyString(2000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  rewardAsset: z.string().trim().min(1).max(80).default('G$'),
  rewardAmount: exactPositiveIntegerAmountSchema,
  leaderboardMode: z.string().trim().min(1).max(40).nullable().optional(),
  requirements: z.record(z.string(), z.unknown()).optional(),
});

export const updateBountySchema = z.object({
  title: nonEmptyString(160).optional(),
  description: nonEmptyString(2000).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  leaderboardMode: z.string().trim().min(1).max(40).nullable().optional(),
  requirements: z.record(z.string(), z.unknown()).optional(),
});

export const bountySubmissionView = z.object({
  id: uuid,
  participationId: uuid,
  status: submissionReviewStatusSchema,
  evidence: z.record(z.string(), z.unknown()),
  reviewNotes: z.string().nullable(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
});

export const bountySchema = z.object({
  id: uuid,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  status: bountyStatusSchema,
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  maxParticipants: z.number().int().positive().nullable(),
  rewardAsset: z.string(),
  rewardAmount: exactPositiveIntegerAmountSchema,
  leaderboardMode: z.string().nullable(),
  requirements: z.record(z.string(), z.unknown()),
  participationsCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const bountyListResponseSchema = z.object({
  data: z.array(bountySchema),
  pagination: paginationSchema,
});

export const bountyParticipationSchema = z.object({
  id: uuid,
  playerId: uuid,
  bountyId: uuid,
  bountySlug: z.string(),
  bountyTitle: z.string(),
  versionId: uuid,
  status: bountyParticipationStatusSchema,
  joinedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  submissions: z.array(bountySubmissionView),
});

export const playerBountyParticipationsResponseSchema = z.object({
  data: z.array(bountyParticipationSchema),
});

export const submitBountyEvidenceSchema = z.object({
  evidence: z.record(z.string(), z.unknown()),
});

export const reviewBountySubmissionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().trim().max(2000).optional(),
});

export const bountyLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  playerId: uuid,
  displayName: z.string().nullable(),
  participationId: uuid,
  joinedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  status: bountyParticipationStatusSchema,
});

export const bountyLeaderboardResponseSchema = z.object({
  data: z.array(bountyLeaderboardEntrySchema),
  pagination: paginationSchema,
});

// ---------------------------------------------------------------------------
// Phase 10: Reward approval and manual distribution contracts
// ---------------------------------------------------------------------------

export const rewardStatusSchema = z.enum(['ELIGIBLE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISTRIBUTION_PENDING', 'DISTRIBUTION_FAILED', 'DISTRIBUTED', 'COMPLETED']);
export const distributionStatusSchema = z.enum(['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED']);

export const rewardDistributionSchema = z.object({
  id: uuid,
  status: distributionStatusSchema,
  transactionReference: z.string().nullable(),
  evidence: z.record(z.string(), z.unknown()).nullable(),
  failureReason: z.string().nullable(),
  attemptedAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
});

export const rewardSchema = z.object({
  id: uuid,
  playerId: uuid,
  sourceType: z.enum(['CHALLENGE', 'BOUNTY']),
  challengeId: uuid.nullable(),
  bountyId: uuid.nullable(),
  asset: nonEmptyString(80),
  amount: z.string().regex(/^\d+$/),
  status: rewardStatusSchema,
  eligibilityEvidence: z.record(z.string(), z.unknown()),
  rejectionReason: z.string().nullable(),
  eligibleAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  distributions: z.array(rewardDistributionSchema),
});

export const rewardListQuerySchema = paginationQuerySchema.extend({ status: rewardStatusSchema.optional() });
export const rewardListResponseSchema = z.object({ data: z.array(rewardSchema), pagination: paginationSchema });

export const reviewRewardSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(1).max(1000).optional(),
}).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'A rejection reason is required.' });
});

export const recordRewardDistributionSchema = z.object({
  status: distributionStatusSchema,
  transactionReference: z.string().trim().min(1).max(255).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  failureReason: z.string().trim().min(1).max(1000).optional(),
}).superRefine((value, context) => {
  if (value.status === 'CONFIRMED' && !value.transactionReference && !value.evidence) context.addIssue({ code: 'custom', path: ['evidence'], message: 'Confirmed distribution requires transaction reference or evidence.' });
  if (value.status === 'FAILED' && !value.failureReason) context.addIssue({ code: 'custom', path: ['failureReason'], message: 'A failure reason is required.' });
});

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'PUBLISH', 'UNPUBLISH', 'PAUSE', 'ARCHIVE', 'APPROVE', 'REJECT', 'DISTRIBUTE', 'RESTRICT', 'PERMISSION_CHANGE', 'SETTINGS_CHANGE']);
export const auditLogQuerySchema = paginationQuerySchema.extend({ action: auditActionSchema.optional(), entityType: z.string().trim().min(1).max(80).optional(), search: z.string().trim().min(1).max(100).optional() });
export const auditLogSchema = z.object({ id: uuid, action: auditActionSchema, entityType: z.string(), entityId: z.string(), reason: z.string().nullable(), createdAt: z.string().datetime(), administrator: z.object({ email: z.string().email().nullable(), displayName: z.string().nullable() }) });
export const auditLogListResponseSchema = z.object({ data: z.array(auditLogSchema), pagination: paginationSchema });

export const operationalMetricsSchema = z.object({
  generatedAt: z.string().datetime(), players: z.object({ total: z.number().int().nonnegative(), active: z.number().int().nonnegative() }),
  goodDollar: z.object({ verifiedRootIdentities: z.number().int().nonnegative() }), gameplay: z.object({ activeSessions: z.number().int().nonnegative(), verifiedScores: z.number().int().nonnegative() }),
  content: z.object({ publishedChallenges: z.number().int().nonnegative(), publishedBounties: z.number().int().nonnegative() }),
  rewards: z.object({ pendingReview: z.number().int().nonnegative(), approved: z.number().int().nonnegative(), distributionPending: z.number().int().nonnegative(), distributed: z.number().int().nonnegative(), failed: z.number().int().nonnegative() }),
  health: z.object({ database: z.literal('reachable') }),
});

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
