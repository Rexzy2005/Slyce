-- Extra lives (shop item 401): one row per life a player uses. The unique (address, useNumber) pair makes
-- concurrent uses unable to spend the same life twice.
CREATE TABLE IF NOT EXISTS "ExtraLifeUse" (
    "id" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "useNumber" INTEGER NOT NULL,
    "ticket" VARCHAR(80) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtraLifeUse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExtraLifeUse_address_useNumber_key" ON "ExtraLifeUse"("address", "useNumber");
CREATE INDEX IF NOT EXISTS "ExtraLifeUse_ticket_idx" ON "ExtraLifeUse"("ticket");
