CREATE TABLE "WalletAuthChallenge" (
    "id" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "nonce" VARCHAR(128) NOT NULL,
    "origin" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletAuthChallenge_nonce_key" ON "WalletAuthChallenge"("nonce");
CREATE INDEX "WalletAuthChallenge_address_expiresAt_idx" ON "WalletAuthChallenge"("address", "expiresAt");
CREATE INDEX "WalletAuthChallenge_expiresAt_idx" ON "WalletAuthChallenge"("expiresAt");
