import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { requireDatabaseUrl } from '../src/database.js';
import { adminPlayerListResponseSchema, apiErrorSchema, leaderboardQuerySchema, playerProfileSchema, sessionResponseSchema } from '../src/api/contracts.js';
import { routePlan } from '../src/api/route-plan.js';
import { parseRequest, requireIdempotencyKey, RequestValidationError } from '../src/api/validation.js';
import { FixedWindowRateLimiter, requireAdminRole, requireAllowedAdministratorEmail, requirePlayerOwnership, SecurityError } from '../src/security.js';
import { requireSupabaseAuthConfig, SupabaseTokenVerifier } from '../src/supabase-auth.js';
import { createApp } from '../src/server.js';
import { PrismaPrincipalStore } from '../src/principal-store.js';
import { PlayerService } from '../src/player-service.js';
import { createPracticeSafeRules, digestInput, GameplayService, type ScoreSubmission, type SessionDescriptor } from '../src/gameplay-service.js';
import { compareLeaderboardCandidates, digestReplayInputs, paginateLeaderboardCandidates, rankLeaderboardCandidates, ScoreVerificationService, VerifiedFruitSliceVerifier } from '../src/gameplay-verifier.js';
import { verifyDeploymentEnvironment } from '../src/deployment-preflight.js';
import { simulateVerifiedFruitSlice, verifiedFruitSliceGameMode, verifiedFruitSliceRulesVersion } from '@slyce/shared/verified-game';
import { LeaderboardService } from '../src/leaderboard-service.js';

test('rejects invalid ports before startup', () => {
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT must be an integer/);
  assert.throws(() => loadConfig({ PORT: 'not-a-port' }), /PORT must be an integer/);
});

test('validates the complete production deployment environment', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    DIRECT_URL: 'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAILS: 'admin@example.com',
    CORS_ORIGINS: 'https://app.example.com',
    AUTH_SESSION_SECRET: 'a'.repeat(32),
  };
  assert.doesNotThrow(() => verifyDeploymentEnvironment(valid));
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, DIRECT_URL: '' }), /DIRECT_URL/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, ADMIN_EMAILS: '' }), /ADMIN_EMAILS/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, CORS_ORIGINS: '' }), /CORS_ORIGINS/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, AUTH_SESSION_SECRET: '' }), /AUTH_SESSION_SECRET/);
});

test('requires a runtime database URL without exposing its value', () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
  assert.equal(requireDatabaseUrl({ DATABASE_URL: 'postgresql://example' }), 'postgresql://example');
});

test('enforces principal ownership and administrator roles', () => {
  const player = { subject: 'p-1', kind: 'player' as const, playerId: 'player-1', roles: [] as const };
  assert.doesNotThrow(() => requirePlayerOwnership(player, 'player-1'));
  assert.throws(() => requirePlayerOwnership(player, 'player-2'), (error: unknown) => error instanceof SecurityError && error.statusCode === 403);
  const reviewer = { subject: 'a-1', kind: 'administrator' as const, roles: ['reviewer' as const] };
  assert.doesNotThrow(() => requireAdminRole(reviewer, 'reviewer'));
  assert.throws(() => requireAdminRole(reviewer, 'admin'), (error: unknown) => error instanceof SecurityError && error.statusCode === 403);
  assert.doesNotThrow(() => requireAllowedAdministratorEmail({ ...reviewer, email: 'Admin@Example.com' }, ['admin@example.com']));
  assert.throws(() => requireAllowedAdministratorEmail({ ...reviewer, email: 'other@example.com' }, ['admin@example.com']), (error: unknown) => error instanceof SecurityError && error.statusCode === 403);
});

test('loads Supabase Auth configuration without requiring a service-role key', () => {
  assert.deepEqual(requireSupabaseAuthConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' }), {
    url: 'https://example.supabase.co',
    anonKey: 'anon',
  });
  assert.throws(() => requireSupabaseAuthConfig({ SUPABASE_URL: 'https://example.supabase.co' }), /SUPABASE_URL and SUPABASE_ANON_KEY/);
});

test('maps verified Supabase users to player or administrator principals', async () => {
  const client = {
    auth: {
      getUser: async (token: string) => token === 'admin-token'
        ? { data: { user: { id: 'admin-id', email: 'ADMIN@example.com' } }, error: null }
        : { data: { user: { id: 'player-id', email: 'player@example.com' } }, error: null },
    },
  };
  const verifier = new SupabaseTokenVerifier(client, ['admin@example.com']);
  assert.deepEqual(await verifier.verify('admin-token'), {
    subject: 'admin-id', kind: 'administrator', email: 'admin@example.com', roles: ['admin'],
  });
  assert.deepEqual(await verifier.verify('player-token'), {
    subject: 'player-id', kind: 'player', email: 'player@example.com', roles: [], playerId: 'player-id',
  });
});

test('maps authenticated principals to persistent records', async () => {
  const calls: unknown[] = [];
  const store = new PrismaPrincipalStore({
    player: { upsert: async args => { calls.push(args); return {}; } },
    adminAccount: { upsert: async args => { calls.push(args); return {}; } },
  });
  await store.ensure({ subject: 'player-id', kind: 'player', playerId: 'player-id', roles: [] });
  await store.ensure({ subject: 'admin-id', kind: 'administrator', email: 'admin@example.com', roles: ['admin'] });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { where: { id: 'player-id' }, create: { id: 'player-id' }, update: {} });
  assert.deepEqual(calls[1], {
    where: { externalSubject: 'admin-id' },
    create: { externalSubject: 'admin-id', email: 'admin@example.com', role: 'ADMIN' },
    update: { email: 'admin@example.com', active: true },
  });
});

test('exposes player profiles and admin list data through typed contracts', async () => {
  const profile = {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: null,
    status: 'ACTIVE' as const,
    wallets: [],
    goodDollarVerification: null,
    createdAt: '2026-10-27T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
  };
  const parsedProfile = playerProfileSchema.parse(profile);
  assert.equal(parsedProfile.id, profile.id);
  assert.equal(parsedProfile.status, profile.status);
  const parsedList = adminPlayerListResponseSchema.parse({ data: [profile], pagination: { nextCursor: null, limit: 25 } });
  assert.equal(parsedList.data[0]?.id, profile.id);
  assert.equal(parsedList.pagination.limit, 25);
  const service = new PlayerService({
    findById: async () => profile,
    list: async () => ({ items: [profile], nextCursor: null }),
  }, { ensure: async () => undefined });
  const playerResult = await service.getProfile(profile.id);
  assert.equal(playerResult?.id, profile.id);
  assert.equal(playerResult?.status, profile.status);
  assert.deepEqual(playerResult?.wallets, []);
  const listed = await service.listPlayers({ limit: 25 });
  assert.equal(listed.items.length, 1);
  assert.equal(listed.nextCursor, null);
});

test('validates gameplay session and score boundaries without claiming authority', async () => {
  const rules = createPracticeSafeRules('practice', 'practice-v1');
  const sessions = new Map<string, Awaited<ReturnType<GameplayService['createSession']>>>();
  const service = new GameplayService({
    create: async session => { sessions.set(session.id, session); },
    findOwned: async (id, playerId) => sessions.get(id)?.playerId === playerId ? sessions.get(id) ?? null : null,
    submitOwnedScore: async ({ submission }) => ({ status: 'accepted', scoreId: '00000000-0000-4000-8000-000000000002', score: submission.score, verificationStatus: 'PENDING' }),
  });
  const principal = { subject: 'player', kind: 'player' as const, playerId: 'player-id', roles: [] as const };
  const session = await service.createSession(principal, rules);
  assert.equal(session.status, 'CREATED');
  assert.equal(digestInput('replay').length, 64);
  assert.equal(await service.validateOwnedSubmission(principal, session.id, rules, { inputDigest: digestInput('replay'), score: 100 }), null);
  assert.match(await service.validateOwnedSubmission(principal, session.id, rules, { inputDigest: digestInput('replay'), score: 1_000_001 }) ?? '', /supported range/);
});

test('keeps accepted gameplay submissions pending until authoritative verification', async () => {
  const rules = createPracticeSafeRules('practice', 'practice-v1');
  let submitted = false;
  const service = new GameplayService({
    create: async () => undefined,
    findOwned: async id => ({
      id,
      playerId: 'player-id',
      gameMode: 'practice',
      status: 'CREATED',
      rulesVersion: 'practice-v1',
      seed: 'seed',
      expiresAt: new Date(Date.now() + 60_000),
    }),
    submitOwnedScore: async ({ submission }) => {
      submitted = true;
      return { status: 'accepted', scoreId: '00000000-0000-4000-8000-000000000003', score: submission.score, verificationStatus: 'PENDING' };
    },
  });

  test('verifies deterministic fruit-slice replays and rejects tampered scores', async () => {
    const inputs = [
      { kind: 'pointer' as const, phase: 'down' as const, elapsedMs: 0, x: 0, y: 0 },
      { kind: 'pointer' as const, phase: 'up' as const, elapsedMs: 0, x: 0, y: 0 },
    ];
    const seed = 'test-seed';
    const simulation = simulateVerifiedFruitSlice(seed, inputs);
    const verifier = new VerifiedFruitSliceVerifier();
    const context = {
      sessionId: 'session',
      playerId: 'player',
      gameMode: verifiedFruitSliceGameMode,
      rulesVersion: verifiedFruitSliceRulesVersion,
      seed,
    };
    const accepted = await verifier.verify(context, { inputDigest: digestReplayInputs(inputs), score: simulation.score, replayInputs: inputs });
    assert.equal(accepted.status, 'verified');
    const rejected = await verifier.verify(context, { inputDigest: digestReplayInputs(inputs), score: simulation.score + 10, replayInputs: inputs });
    assert.deepEqual(rejected, { status: 'rejected', reason: 'Submitted score does not match the deterministic replay result.' });
  });

  test('claims a pending score once under concurrent verification attempts', async () => {
    let claimed = false;
    let verifierCalls = 0;
    let promotions = 0;
    const inputs = [
      { kind: 'pointer' as const, phase: 'down' as const, elapsedMs: 0, x: 0, y: 0 },
      { kind: 'pointer' as const, phase: 'up' as const, elapsedMs: 0, x: 0, y: 0 },
    ];
    const service = new ScoreVerificationService({
      claimPending: async () => {
        if (claimed) return null;
        claimed = true;
        return {
          id: 'score',
          playerId: 'player',
          score: 0,
          inputDigest: digestReplayInputs(inputs),
          replayInputs: inputs,
          context: { sessionId: 'session', playerId: 'player', gameMode: 'mode', rulesVersion: 'v1', seed: 'seed' },
        };
      },
      markVerified: async () => { promotions += 1; },
      markRejected: async () => undefined,
    }, {
      verify: async () => {
        verifierCalls += 1;
        await new Promise(resolve => setImmediate(resolve));
        return { status: 'verified', score: 0 };
      },
    });

    const results = await Promise.all([service.verifyPending('score'), service.verifyPending('score')]);
    assert.equal(results.filter(result => result.status === 'verified').length, 1);
    assert.equal(verifierCalls, 1);
    assert.equal(promotions, 1);
  });

  test('ranks leaderboard candidates deterministically by score, time, then ID', () => {
    const ranked = rankLeaderboardCandidates([
      { scoreId: 'b', playerId: 'p2', score: 100, tieBreakerAt: new Date('2026-01-01T00:01:00Z') },
      { scoreId: 'a', playerId: 'p1', score: 100, tieBreakerAt: new Date('2026-01-01T00:00:00Z') },
      { scoreId: 'c', playerId: 'p3', score: 120, tieBreakerAt: new Date('2026-01-01T00:02:00Z') },
    ]);
    assert.deepEqual(ranked.map(entry => [entry.rank, entry.scoreId]), [[1, 'c'], [2, 'a'], [3, 'b']]);
    assert.equal(compareLeaderboardCandidates(ranked[1]!, ranked[2]!) < 0, true);
  });

  test('paginates ranked leaderboard candidates without changing rank values', () => {
    const candidates = [
      { scoreId: 'a', playerId: 'p1', score: 100, tieBreakerAt: new Date('2026-01-01T00:00:00Z') },
      { scoreId: 'b', playerId: 'p2', score: 90, tieBreakerAt: new Date('2026-01-01T00:01:00Z') },
      { scoreId: 'c', playerId: 'p3', score: 80, tieBreakerAt: new Date('2026-01-01T00:02:00Z') },
    ];
    assert.deepEqual(paginateLeaderboardCandidates(candidates, 2), {
      items: [{ ...candidates[0], rank: 1 }, { ...candidates[1], rank: 2 }],
      nextCursor: 2,
    });

    test('lists only verified leaderboard rows with stable period pagination', async () => {
      const service = new LeaderboardService({
        findVerified: async () => [
          { scoreId: 'old', playerId: 'p-old', displayName: 'Old', score: 999, tieBreakerAt: new Date('2026-10-19T23:59:00Z') },
          { scoreId: 'new', playerId: 'p-new', displayName: 'New', score: 100, tieBreakerAt: new Date('2026-10-27T12:00:00Z') },
        ],
      }, () => new Date('2026-10-27T15:00:00Z'));
      const result = await service.list({ scope: 'today', limit: 25 });
      assert.deepEqual(result.items.map(item => item.scoreId), ['new']);
      assert.equal(result.items[0]?.rank, 1);
    });

    test('rejects non-numeric leaderboard cursors', () => {
      assert.throws(() => leaderboardQuerySchema.parse({ scope: 'all', cursor: 'not-a-number' }));
    });
    assert.deepEqual(paginateLeaderboardCandidates(candidates, 2, 2), {
      items: [{ ...candidates[2], rank: 3 }],
      nextCursor: null,
    });
  });
  const result = await service.submitScore(
    { subject: 'player', kind: 'player', playerId: 'player-id', roles: [] },
    '00000000-0000-4000-8000-000000000004',
    rules,
    { inputDigest: digestInput('replay'), score: 42 },
    'submission-key-123456',
  );
  assert.equal(submitted, true);
  assert.deepEqual(result, {
    status: 'accepted',
    scoreId: '00000000-0000-4000-8000-000000000003',
    score: 42,
    verificationStatus: 'PENDING',
  });
});

test('rate limiter rejects requests only after the configured window quota', () => {
  let now = 0;
  const limiter = new FixedWindowRateLimiter(1000, 2, () => now);
  assert.equal(limiter.allow('client'), true);
  assert.equal(limiter.allow('client'), true);
  assert.equal(limiter.allow('client'), false);
  now = 1000;
  assert.equal(limiter.allow('client'), true);
});

test('validates versioned API query and idempotency contracts', () => {
  assert.deepEqual(leaderboardQuerySchema.parse({ scope: 'today', limit: '10' }), { scope: 'today', limit: 10 });
  assert.throws(() => parseRequest(leaderboardQuerySchema, { scope: 'invalid' }), RequestValidationError);
  assert.equal(requireIdempotencyKey('request-key-123456'), 'request-key-123456');
  assert.throws(() => requireIdempotencyKey('short'), RequestValidationError);
  assert.throws(() => requireIdempotencyKey('request key 123456'), RequestValidationError);
  assert.equal(apiErrorSchema.parse({ error: { code: 'bad_request', message: 'Invalid input.' } }).error.code, 'bad_request');
  assert.ok(routePlan.some(route => route.path === '/api/v1/gameplay/rounds' && route.idempotent));
});

test('serves health and readiness endpoints without exposing configuration', async () => {
  const server = createApp({
    environment: 'test',
    port: 0,
    host: '127.0.0.1',
    corsOrigins: ['https://slyce.example'],
    maxRequestBytes: 100,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 10,
    adminEmails: [], goodDollarEnvironment: 'development',
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.equal(typeof address, 'object');
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP address');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'slyce-backend' });

  const cors = await fetch(`${baseUrl}/healthz`, { headers: { Origin: 'https://slyce.example' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://slyce.example');

  const readiness = await fetch(`${baseUrl}/readyz`);
  assert.equal(readiness.status, 503);
  assert.deepEqual(await readiness.json(), { status: 'not_ready', checks: { database: 'not_configured' } });

  const missing = await fetch(`${baseUrl}/private-config`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /not_found/);
  server.close();
  await once(server, 'close');
});

test('protects and serves the authenticated session endpoint', async () => {
  const server = createApp({
    environment: 'test', port: 0, host: '127.0.0.1', corsOrigins: [],
    maxRequestBytes: 100, rateLimitWindowMs: 60_000, rateLimitMaxRequests: 10, adminEmails: [], goodDollarEnvironment: 'development',
  }, {
    verifier: { verify: async token => token === 'valid' ? { subject: 'player-id', kind: 'player', playerId: '00000000-0000-4000-8000-000000000001', roles: [] } : null },
    walletVerifier: { verify: async token => token === 'valid' ? { subject: 'player-id', kind: 'player', playerId: '00000000-0000-4000-8000-000000000001', roles: [] } : null },
    principalStore: { ensure: async () => undefined },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1/session`;
  const unauthenticated = await fetch(baseUrl);
  assert.equal(unauthenticated.status, 401);
  const authenticated = await fetch(baseUrl, { headers: { Authorization: 'Bearer valid' } });
  assert.equal(authenticated.status, 200);
  const authenticatedBody = await authenticated.json() as { data: unknown };
  assert.deepEqual(sessionResponseSchema.parse(authenticatedBody.data), {
    status: 'authenticated', kind: 'player', subject: 'player-id', playerId: '00000000-0000-4000-8000-000000000001',
  });
  server.close();
  await once(server, 'close');
});

test('creates and verifies an authenticated deterministic gameplay round', async () => {
    const sessions = new Map<string, Awaited<ReturnType<GameplayService['createSession']>>>();
    const scoreId = '00000000-0000-4000-8000-000000000009';
    const replayInputs = [
      { kind: 'pointer' as const, phase: 'down' as const, elapsedMs: 0, x: 0, y: 0 },
      { kind: 'pointer' as const, phase: 'up' as const, elapsedMs: 0, x: 0, y: 0 },
    ];
    const gameplay = new GameplayService({
      create: async (session: SessionDescriptor) => { sessions.set(session.id, session); },
      findOwned: async (id: string, playerId: string) => sessions.get(id)?.id === id && sessions.get(id)?.playerId === playerId ? sessions.get(id)! : null,
      submitOwnedScore: async ({ session, submission }: { session: SessionDescriptor; submission: ScoreSubmission }) => ({
        status: 'accepted',
        scoreId,
        score: submission.score,
        verificationStatus: 'PENDING',
        session,
        submission,
      }),
    } as never);
    const verification = new ScoreVerificationService({
      claimPending: async id => id === scoreId ? {
        id,
        playerId: '00000000-0000-4000-8000-000000000001',
        score: 0,
        inputDigest: digestReplayInputs(replayInputs),
        replayInputs,
        context: {
          sessionId: 'session',
          playerId: '00000000-0000-4000-8000-000000000001',
          gameMode: 'verified-fruit-slice',
          rulesVersion: 'verified-fruit-slice-v1',
          seed: 'seed',
        },
      } : null,
      markVerified: async () => undefined,
      markRejected: async () => undefined,
    }, new VerifiedFruitSliceVerifier());
    const server = createApp({
      environment: 'test', port: 0, host: '127.0.0.1', corsOrigins: [],
      maxRequestBytes: 100_000, rateLimitWindowMs: 60_000, rateLimitMaxRequests: 20, adminEmails: [], goodDollarEnvironment: 'development',
    }, {
      verifier: { verify: async token => token === 'valid' ? { subject: 'player-id', kind: 'player', playerId: '00000000-0000-4000-8000-000000000001', roles: [] } : null },
      walletVerifier: { verify: async token => token === 'valid' ? { subject: 'player-id', kind: 'player', playerId: '00000000-0000-4000-8000-000000000001', roles: [] } : null },
      gameplayService: gameplay,
      scoreVerificationService: verification,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/gameplay/rounds`;
    const start = await fetch(baseUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameMode: 'verified-fruit-slice', rulesVersion: 'verified-fruit-slice-v1' }),
    });
    assert.equal(start.status, 201);
    const started = (await start.json() as { data: { id: string } }).data;
    assert.ok(started.id);
    const finish = await fetch(`${baseUrl}/${started.id}/finish`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json', 'Idempotency-Key': 'verified-round-123456' },
      body: JSON.stringify({ inputDigest: digestReplayInputs(replayInputs), score: 0, replayInputs }),
    });
    assert.equal(finish.status, 200);
    const finished = (await finish.json() as { data: { status: string; verificationStatus: string } }).data;
    assert.deepEqual(finished, { status: 'verified', scoreId, score: 0, verificationStatus: 'VERIFIED' });
    server.close();
    await once(server, 'close');
});
