import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.js';
import { RewardService, type RecordDistributionInput, type RewardRepository, type RewardStatusType, type RewardView, type ReviewRewardInput } from '../src/reward-service.js';
import type { AuthenticatedPrincipal } from '../src/security.js';

const rewardId = '00000000-0000-4000-8000-000000000090';
const playerId = '00000000-0000-4000-8000-000000000091';

function reward(overrides: Partial<RewardView> = {}): RewardView {
  const timestamp = new Date().toISOString();
  return {
    id: rewardId, playerId, sourceType: 'CHALLENGE', challengeId: '00000000-0000-4000-8000-000000000092', bountyId: null,
    asset: 'G$', amount: '100', status: 'ELIGIBLE', eligibilityEvidence: { participationId: 'test' }, rejectionReason: null,
    eligibleAt: timestamp, createdAt: timestamp, updatedAt: timestamp, distributions: [], ...overrides,
  };
}

class MockRewardRepository implements RewardRepository {
  current = reward();
  async list(input: { playerId?: string; status?: RewardStatusType; cursor?: string; limit: number }) {
    const visible = (!input.playerId || input.playerId === this.current.playerId) && (!input.status || input.status === this.current.status);
    return { items: visible ? [this.current] : [], nextCursor: null };
  }
  async review(id: string, adminSubject: string, input: ReviewRewardInput) {
    assert.equal(id, rewardId); assert.equal(adminSubject, 'admin-subject');
    if (!['ELIGIBLE', 'PENDING_REVIEW'].includes(this.current.status)) throw new Error('This reward has already been reviewed.');
    this.current = reward({ ...this.current, status: input.decision, rejectionReason: input.decision === 'REJECTED' ? input.reason ?? null : null });
    return this.current;
  }
  async recordDistribution(id: string, adminSubject: string, input: RecordDistributionInput) {
    assert.equal(id, rewardId); assert.equal(adminSubject, 'admin-subject');
    if (this.current.status !== 'APPROVED' && this.current.status !== 'DISTRIBUTION_FAILED') throw new Error('Only an approved reward can be distributed.');
    if (input.status === 'CONFIRMED' && !input.transactionReference && !input.evidence) throw new Error('Confirmed distribution requires evidence.');
    const timestamp = new Date().toISOString();
    this.current = reward({ ...this.current, status: input.status === 'CONFIRMED' ? 'DISTRIBUTED' : input.status === 'FAILED' ? 'DISTRIBUTION_FAILED' : 'DISTRIBUTION_PENDING', distributions: [{ id: '00000000-0000-4000-8000-000000000093', status: input.status, transactionReference: input.transactionReference ?? null, evidence: input.evidence ?? null, failureReason: input.failureReason ?? null, attemptedAt: timestamp, confirmedAt: input.status === 'CONFIRMED' ? timestamp : null }] });
    return this.current;
  }
}

const admin: AuthenticatedPrincipal = { kind: 'administrator', subject: 'admin-subject', roles: ['admin'] };
const player: AuthenticatedPrincipal = { kind: 'player', subject: 'player-subject', playerId, roles: [] };

await it('requires administrative review before distribution', async () => {
  const service = new RewardService(new MockRewardRepository());
  await assert.rejects(() => service.recordDistribution(admin, rewardId, { status: 'CONFIRMED', transactionReference: '0xabc' }), /approved/i);
});

await it('separates approval from confirmed manual distribution', async () => {
  const service = new RewardService(new MockRewardRepository());
  const approved = await service.review(admin, rewardId, { decision: 'APPROVED', reason: 'Verified outcome.' });
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.distributions.length, 0);
  const distributed = await service.recordDistribution(admin, rewardId, { status: 'CONFIRMED', transactionReference: '0xabc123' });
  assert.equal(distributed.status, 'DISTRIBUTED');
  assert.equal(distributed.distributions[0]?.status, 'CONFIRMED');
});

await it('rejects unauthorized reward review', async () => {
  const service = new RewardService(new MockRewardRepository());
  assert.throws(() => service.review(player, rewardId, { decision: 'APPROVED' }), /administrator/i);
});

await it('serves player and administrator reward routes', async () => {
  const repository = new MockRewardRepository();
  const service = new RewardService(repository);
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { verifier: { verify: async () => admin }, walletVerifier: { verify: async () => player }, rewardService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const playerList = await fetch(`${base}/api/v1/rewards`, { headers: { Authorization: 'Bearer player' } });
    assert.equal(playerList.status, 200);
    const approval = await fetch(`${base}/api/v1/admin/rewards/${rewardId}/review`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'APPROVED' }) });
    assert.equal(approval.status, 200);
    const distribution = await fetch(`${base}/api/v1/admin/rewards/${rewardId}/distributions`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED', transactionReference: '0xroute' }) });
    assert.equal(distribution.status, 201);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
