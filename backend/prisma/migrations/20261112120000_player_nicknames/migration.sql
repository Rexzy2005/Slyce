-- Player nicknames (ADR-0017): one per wallet, unique regardless of letter case.
CREATE TABLE IF NOT EXISTS "PlayerNickname" (
    "address" VARCHAR(42) NOT NULL,
    "nickname" VARCHAR(16) NOT NULL,
    "nicknameKey" VARCHAR(16) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerNickname_pkey" PRIMARY KEY ("address")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerNickname_nicknameKey_key" ON "PlayerNickname"("nicknameKey");
