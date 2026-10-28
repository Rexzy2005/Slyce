import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.js';
import { OperationsService, type OperationsRepository, type OperationalMetrics } from '../src/operations-service.js';
import type { AuthenticatedPrincipal } from '../src/security.js';

const metrics: OperationalMetrics = { generatedAt: new Date().toISOString(), players: { total: 4, active: 3 }, goodDollar: { verifiedRootIdentities: 2 }, gameplay: { activeSessions: 1, verifiedScores: 7 }, content: { publishedChallenges: 1, publishedBounties: 2 }, rewards: { pendingReview: 3, approved: 1, distributionPending: 1, distributed: 5, failed: 1 }, health: { database: 'reachable' } };
class MockOperationsRepository implements OperationsRepository {
  async ping() {}
  async metrics() { return metrics; }
  async auditLogs() { return { items: [{ id: '00000000-0000-4000-8000-000000000099', action: 'APPROVE', entityType: 'Reward', entityId: 'reward-1', reason: null, createdAt: new Date().toISOString(), administrator: { email: 'admin@example.com', displayName: null } }], nextCursor: null }; }
}
const admin: AuthenticatedPrincipal = { kind: 'administrator', subject: 'admin', roles: ['admin'] };
const player: AuthenticatedPrincipal = { kind: 'player', subject: 'player', playerId: '00000000-0000-4000-8000-000000000098', roles: [] };

await it('restricts operational metrics to administrators', async () => {
  const service = new OperationsService(new MockOperationsRepository(), 'development');
  assert.throws(() => service.metrics(player), /administrator/i);
  assert.equal((await service.metrics(admin)).players.total, 4);
});

await it('serves readiness, metrics, and paginated audit logs', async () => {
  const service = new OperationsService(new MockOperationsRepository(), 'development');
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { verifier: { verify: async () => admin }, operationsService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/readyz`)).status, 200);
    assert.equal((await fetch(`${base}/api/v1/admin/metrics`, { headers: { Authorization: 'Bearer admin' } })).status, 200);
    const response = await fetch(`${base}/api/v1/admin/audit-logs?action=APPROVE`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { data: unknown[] }).data.length, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
