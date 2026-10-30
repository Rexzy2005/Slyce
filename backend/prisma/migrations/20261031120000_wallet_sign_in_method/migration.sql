ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "signInMethod" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "Player_createdAt_idx" ON "Player"("createdAt");
