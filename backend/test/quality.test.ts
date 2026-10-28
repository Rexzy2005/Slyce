import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.js';
import { OperationsService, type OperationsRepository } from '../src/operations-service.js';
import type { AuthenticatedPrincipal } from '../src/security.js';

const admin: AuthenticatedPrincipal = { kind: 'administrator', subject: 'admin-subject', email: 'admin@example.com', roles: ['admin'] };
const config = { port: 0, host: '127.0.0.1', environment: 'test' as const, corsOrigins: [] as string[], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [] as string[], goodDollarEnvironment: 'development' as const };
const metrics = { generatedAt: new Date().toISOString(), players: { total: 1, active: 1 }, goodDollar: { verifiedRootIdentities: 1 }, gameplay: { activeSessions: 0, verifiedScores: 1 }, content: { publishedChallenges: 0, publishedBounties: 0 }, rewards: { pendingReview: 0, approved: 0, distributionPending: 0, distributed: 0, failed: 0 }, health: { database: 'reachable' as const } };

class QualityRepository implements OperationsRepository {
  constructor(private readonly healthy = true) {}
  async ping() { if (!this.healthy) throw new Error('database detail must stay private'); }
  async metrics() { return metrics; }
  async auditLogs() { return { items: [{ id: '00000000-0000-4000-8000-000000000088', action: 'APPROVE', entityType: 'Reward', entityId: 'reward-safe-id', reason: null, createdAt: new Date().toISOString(), administrator: { email: 'admin@example.com', displayName: null } }], nextCursor: null }; }
}

async function withServer(repository: QualityRepository, test: (base: string) => Promise<void>) {
  const server = createApp(config, { verifier: { verify: async token => token === 'admin' ? admin : null }, operationsService: new OperationsService(repository, 'development') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await test(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

await it('rejects unauthenticated administrative visibility requests', async () => {
  await withServer(new QualityRepository(), async base => {
    assert.equal((await fetch(`${base}/api/v1/admin/metrics`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/admin/audit-logs`)).status, 401);
  });
});

await it('returns structured 400 responses for invalid audit filters', async () => {
  await withServer(new QualityRepository(), async base => {
    const response = await fetch(`${base}/api/v1/admin/audit-logs?action=NOT_REAL`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: { code: string; fields?: Record<string, string[]> } };
    assert.equal(body.error.code, 'validation_error');
    assert.ok(body.error.fields?.action);
  });
});

await it('does not expose sensitive audit snapshots or authentication subjects', async () => {
  await withServer(new QualityRepository(), async base => {
    const response = await fetch(`${base}/api/v1/admin/audit-logs`, { headers: { Authorization: 'Bearer admin' } });
    const serialized = JSON.stringify(await response.json());
    assert.equal(serialized.includes('before'), false);
    assert.equal(serialized.includes('after'), false);
    assert.equal(serialized.includes('admin-subject'), false);
  });
});

await it('reports database readiness failure without leaking the failure detail', async () => {
  await withServer(new QualityRepository(false), async base => {
    const response = await fetch(`${base}/readyz`);
    assert.equal(response.status, 503);
    const serialized = JSON.stringify(await response.json());
    assert.equal(serialized.includes('database detail'), false);
  });
});
