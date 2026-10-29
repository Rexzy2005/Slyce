ALTER TABLE "AdminAccount" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(512);

CREATE INDEX IF NOT EXISTS "AdminAccount_email_idx" ON "AdminAccount"("email");

CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "adminId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminSession_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminSession"
      ADD CONSTRAINT "AdminSession_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_revokedAt_expiresAt_idx" ON "AdminSession"("adminId", "revokedAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
