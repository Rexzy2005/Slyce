CREATE TABLE "GoodDollarVerificationRecord" (
    "id" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "environment" VARCHAR(20) NOT NULL,
    "state" "GoodDollarVerificationState" NOT NULL DEFAULT 'UNKNOWN',
    "rootIdentityReference" VARCHAR(42),
    "lastAuthenticatedAt" TIMESTAMP(3),
    "lastSuccessfulCheckAt" TIMESTAMP(3),
    "lastAttemptedCheckAt" TIMESTAMP(3),
    "unavailableReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoodDollarVerificationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoodDollarVerificationRecord_address_environment_key" ON "GoodDollarVerificationRecord"("address", "environment");
CREATE INDEX "GoodDollarVerificationRecord_environment_state_idx" ON "GoodDollarVerificationRecord"("environment", "state");
CREATE INDEX "GoodDollarVerificationRecord_rootIdentityReference_environment_idx" ON "GoodDollarVerificationRecord"("rootIdentityReference", "environment");
