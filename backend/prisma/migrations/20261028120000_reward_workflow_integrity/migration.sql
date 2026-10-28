-- One participation can produce at most one reward eligibility record.
CREATE UNIQUE INDEX "Reward_challengeParticipationId_key" ON "Reward"("challengeParticipationId");
CREATE UNIQUE INDEX "Reward_bountyParticipationId_key" ON "Reward"("bountyParticipationId");

-- A transaction reference cannot be used as evidence for multiple distributions.
CREATE UNIQUE INDEX "RewardDistribution_transactionReference_key" ON "RewardDistribution"("transactionReference");
