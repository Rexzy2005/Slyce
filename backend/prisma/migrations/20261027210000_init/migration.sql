-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "WalletVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "GoodDollarVerificationState" AS ENUM ('UNKNOWN', 'VERIFIED', 'UNVERIFIED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('CREATED', 'STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChallengeParticipationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'DISQUALIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BountyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BountyParticipationStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISQUALIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubmissionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RewardSourceType" AS ENUM ('CHALLENGE', 'BOUNTY');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('ELIGIBLE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISTRIBUTION_PENDING', 'DISTRIBUTION_FAILED', 'DISTRIBUTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RewardApprovalStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OPERATOR', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'UNPUBLISH', 'PAUSE', 'ARCHIVE', 'APPROVE', 'REJECT', 'DISTRIBUTE', 'RESTRICT', 'PERMISSION_CHANGE', 'SETTINGS_CHANGE');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(80),
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "restrictionReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "WalletVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodDollarVerification" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "walletId" UUID,
    "state" "GoodDollarVerificationState" NOT NULL DEFAULT 'UNKNOWN',
    "rootIdentityReference" VARCHAR(255),
    "lastSuccessfulCheckAt" TIMESTAMP(3),
    "lastAttemptedCheckAt" TIMESTAMP(3),
    "unavailableReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodDollarVerification_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "gameMode" VARCHAR(40) NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'CREATED',
    "rulesVersion" VARCHAR(80) NOT NULL,
    "seed" VARCHAR(128) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreRecord" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "ScoreStatus" NOT NULL DEFAULT 'PENDING',
    "rulesVersion" VARCHAR(80) NOT NULL,
    "inputDigest" VARCHAR(128) NOT NULL,
    "breakdown" JSONB,
    "rejectionReason" VARCHAR(500),
    "verifiedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(40) NOT NULL,
    "gameMode" VARCHAR(40) NOT NULL DEFAULT '',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "scoreId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "tieBreakerAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeVersion" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "rulesVersion" VARCHAR(80) NOT NULL,
    "rewardAsset" VARCHAR(80) NOT NULL,
    "rewardAmount" DECIMAL(78,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ChallengeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRule" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "operator" VARCHAR(40) NOT NULL,
    "counter" VARCHAR(80),
    "threshold" DECIMAL(78,0),
    "configuration" JSONB NOT NULL,

    CONSTRAINT "ChallengeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipation" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "ChallengeParticipationStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" JSONB NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bounty" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "BountyStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "rewardAsset" VARCHAR(80) NOT NULL,
    "rewardAmount" DECIMAL(78,0) NOT NULL,
    "leaderboardMode" VARCHAR(40),
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountyVersion" (
    "id" UUID NOT NULL,
    "bountyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BountyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountyParticipation" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "bountyId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "status" "BountyParticipationStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BountyParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountySubmission" (
    "id" UUID NOT NULL,
    "participationId" UUID NOT NULL,
    "status" "SubmissionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB NOT NULL,
    "reviewNotes" VARCHAR(2000),
    "reviewedById" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "BountySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "sourceType" "RewardSourceType" NOT NULL,
    "challengeId" UUID,
    "challengeParticipationId" UUID,
    "bountyId" UUID,
    "bountyParticipationId" UUID,
    "asset" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "eligibilityEvidence" JSONB NOT NULL,
    "rejectionReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardApproval" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "status" "RewardApprovalStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardDistribution" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "attemptedById" UUID NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB,
    "transactionReference" VARCHAR(255),
    "failureReason" VARCHAR(1000),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "RewardDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" UUID NOT NULL,
    "externalSubject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "displayName" VARCHAR(160),
    "role" "AdminRole" NOT NULL DEFAULT 'REVIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(80) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "playerId" UUID,
    "adminId" UUID,
    "operation" VARCHAR(100) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_status_createdAt_idx" ON "Player"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Wallet_playerId_status_idx" ON "Wallet"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_chainId_address_key" ON "Wallet"("chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "GoodDollarVerification_playerId_key" ON "GoodDollarVerification"("playerId");

-- CreateIndex
CREATE INDEX "GoodDollarVerification_state_lastAttemptedCheckAt_idx" ON "GoodDollarVerification"("state", "lastAttemptedCheckAt");

-- CreateIndex
CREATE INDEX "GoodDollarVerification_walletId_idx" ON "GoodDollarVerification"("walletId");

-- CreateIndex
CREATE INDEX "GameSession_playerId_createdAt_idx" ON "GameSession"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_status_expiresAt_idx" ON "GameSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GameSession_gameMode_createdAt_idx" ON "GameSession"("gameMode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRecord_sessionId_key" ON "ScoreRecord"("sessionId");

-- CreateIndex
CREATE INDEX "ScoreRecord_playerId_status_score_idx" ON "ScoreRecord"("playerId", "status", "score");

-- CreateIndex
CREATE INDEX "ScoreRecord_status_createdAt_idx" ON "ScoreRecord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreRecord_rulesVersion_idx" ON "ScoreRecord"("rulesVersion");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_scope_gameMode_periodStart_periodEnd_idx" ON "LeaderboardSnapshot"("scope", "gameMode", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_scope_gameMode_periodStart_periodEnd_key" ON "LeaderboardSnapshot"("scope", "gameMode", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_snapshotId_score_idx" ON "LeaderboardEntry"("snapshotId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_snapshotId_rank_key" ON "LeaderboardEntry"("snapshotId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_snapshotId_scoreId_key" ON "LeaderboardEntry"("snapshotId", "scoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE INDEX "Challenge_status_startsAt_endsAt_idx" ON "Challenge"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ChallengeVersion_challengeId_status_idx" ON "ChallengeVersion"("challengeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeVersion_challengeId_version_key" ON "ChallengeVersion"("challengeId", "version");

-- CreateIndex
CREATE INDEX "ChallengeRule_eventType_operator_idx" ON "ChallengeRule"("eventType", "operator");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRule_versionId_position_key" ON "ChallengeRule"("versionId", "position");

-- CreateIndex
CREATE INDEX "ChallengeParticipation_playerId_status_idx" ON "ChallengeParticipation"("playerId", "status");

-- CreateIndex
CREATE INDEX "ChallengeParticipation_challengeId_status_idx" ON "ChallengeParticipation"("challengeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipation_playerId_versionId_attemptNumber_key" ON "ChallengeParticipation"("playerId", "versionId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_slug_key" ON "Bounty"("slug");

-- CreateIndex
CREATE INDEX "Bounty_status_startsAt_endsAt_idx" ON "Bounty"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BountyVersion_bountyId_version_key" ON "BountyVersion"("bountyId", "version");

-- CreateIndex
CREATE INDEX "BountyParticipation_bountyId_status_idx" ON "BountyParticipation"("bountyId", "status");

-- CreateIndex
CREATE INDEX "BountyParticipation_playerId_status_idx" ON "BountyParticipation"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BountyParticipation_playerId_versionId_key" ON "BountyParticipation"("playerId", "versionId");

-- CreateIndex
CREATE INDEX "BountySubmission_participationId_status_idx" ON "BountySubmission"("participationId", "status");

-- CreateIndex
CREATE INDEX "BountySubmission_reviewedById_reviewedAt_idx" ON "BountySubmission"("reviewedById", "reviewedAt");

-- CreateIndex
CREATE INDEX "Reward_playerId_status_idx" ON "Reward"("playerId", "status");

-- CreateIndex
CREATE INDEX "Reward_status_createdAt_idx" ON "Reward"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Reward_sourceType_challengeId_bountyId_idx" ON "Reward"("sourceType", "challengeId", "bountyId");

-- CreateIndex
CREATE INDEX "RewardApproval_rewardId_createdAt_idx" ON "RewardApproval"("rewardId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardApproval_adminId_createdAt_idx" ON "RewardApproval"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardDistribution_rewardId_attemptedAt_idx" ON "RewardDistribution"("rewardId", "attemptedAt");

-- CreateIndex
CREATE INDEX "RewardDistribution_status_attemptedAt_idx" ON "RewardDistribution"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_externalSubject_key" ON "AdminAccount"("externalSubject");

-- CreateIndex
CREATE INDEX "AdminAccount_active_role_idx" ON "AdminAccount"("active", "role");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "ChallengeEvent_eventType_occurredAt_idx" ON "ChallengeEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEvent_sessionId_sequence_key" ON "ChallengeEvent"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "IdempotencyKey_playerId_operation_idx" ON "IdempotencyKey"("playerId", "operation");

-- CreateIndex
CREATE INDEX "IdempotencyKey_adminId_operation_idx" ON "IdempotencyKey"("adminId", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_operation_key" ON "IdempotencyKey"("key", "operation");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodDollarVerification" ADD CONSTRAINT "GoodDollarVerification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodDollarVerification" ADD CONSTRAINT "GoodDollarVerification_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRecord" ADD CONSTRAINT "ScoreRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRecord" ADD CONSTRAINT "ScoreRecord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "LeaderboardSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "ScoreRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeVersion" ADD CONSTRAINT "ChallengeVersion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChallengeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChallengeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyVersion" ADD CONSTRAINT "BountyVersion_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyParticipation" ADD CONSTRAINT "BountyParticipation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyParticipation" ADD CONSTRAINT "BountyParticipation_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyParticipation" ADD CONSTRAINT "BountyParticipation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BountyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountySubmission" ADD CONSTRAINT "BountySubmission_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "BountyParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountySubmission" ADD CONSTRAINT "BountySubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_challengeParticipationId_fkey" FOREIGN KEY ("challengeParticipationId") REFERENCES "ChallengeParticipation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_bountyParticipationId_fkey" FOREIGN KEY ("bountyParticipationId") REFERENCES "BountyParticipation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardApproval" ADD CONSTRAINT "RewardApproval_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardApproval" ADD CONSTRAINT "RewardApproval_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDistribution" ADD CONSTRAINT "RewardDistribution_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDistribution" ADD CONSTRAINT "RewardDistribution_attemptedById_fkey" FOREIGN KEY ("attemptedById") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEvent" ADD CONSTRAINT "ChallengeEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
