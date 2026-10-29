import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { requireDatabaseUrl } from '../src/database.js';
import { adminPlayerListResponseSchema, apiErrorSchema, createBountySchema, createChallengeSchema, leaderboardQuerySchema, playerProfileSchema, sessionResponseSchema } from '../src/api/contracts.js';
import { routePlan } from '../src/api/route-plan.js';
import { parseRequest, requireIdempotencyKey, RequestValidationError } from '../src/api/validation.js';
import { FixedWindowRateLimiter, requireAdminRole, requireAllowedAdministratorEmail, requirePlayerOwnership, SecurityError } from '../src/security.js';
import { createApp } from '../src/server.js';
import { PrismaPrincipalStore } from '../src/principal-store.js';
import { PlayerService } from '../src/player-service.js';
import { createPracticeSafeRules, digestInput, GameplayService, type ScoreSubmission, type SessionDescriptor } from '../src/gameplay-service.js';
import { compareLeaderboardCandidates, digestReplayInputs, paginateLeaderboardCandidates, rankLeaderboardCandidates, ScoreVerificationService, VerifiedFruitSliceVerifier } from '../src/gameplay-verifier.js';
import { verifyDeploymentEnvironment } from '../src/deployment-preflight.js';
import { simulateVerifiedFruitSlice, verifiedFruitSliceGameMode, verifiedFruitSliceRulesVersion } from '@slyyce/shared/verified-game';
import { LeaderboardService } from '../src/leaderboard-service.js';
import { PrismaWalletChallengeStore } from '../src/wallet-auth.js';
import { createWalletSessionToken, WalletSessionTokenVerifier } from '../src/wallet-auth.js';
import { isWithinActiveWindow } from '../src/active-window.js';

test('rejects invalid ports before startup', () => {
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT must be an integer/);
  assert.throws(() => loadConfig({ PORT: 'not-a-port' }), /PORT must be an integer/);
});

test('validates the complete production deployment environment', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    DIRECT_URL: 'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    SUPABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----',
    SLYCE_ADMIN_EMAILS: ' Admin@Example.com, operator@example.com, ADMIN@example.com ',
    CORS_ORIGINS: 'https://app.example.com',
    AUTH_SESSION_SECRET: 'a'.repeat(32),
  };
  assert.doesNotThrow(() => verifyDeploymentEnvironment(valid));
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, DIRECT_URL: '' }), /DIRECT_URL/);
  assert.deepEqual(loadConfig(valid).adminEmails, ['admin@example.com', 'operator@example.com']);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, SLYCE_ADMIN_EMAILS: '' }), /SLYCE_ADMIN_EMAILS/);
  assert.throws(() => loadConfig({ SLYCE_ADMIN_EMAILS: 'admin@example.com,not-an-email' }), /valid comma-separated/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, CORS_ORIGINS: '' }), /CORS_ORIGINS/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, AUTH_SESSION_SECRET: '' }), /AUTH_SESSION_SECRET/);
  assert.throws(() => verifyDeploymentEnvironment({ ...valid, SUPABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nreplace-with-ca\\n-----END CERTIFICATE-----' }), /SUPABASE_CA_CERT/);
});

test('requires a runtime database URL without exposing its value', () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
  assert.equal(requireDatabaseUrl({ DATABASE_URL: 'postgresql://example' }), 'postgresql://example');
});

test('claims a wallet authentication nonce only once under concurrent consumption', async () => {
  const now = new Date('2026-10-29T00:00:00.000Z');
  const challenge = {
    id: '00000000-0000-4000-8000-000000000099',
    address: '0x0000000000000000000000000000000000000001',
    chainId: 42220,
    nonce: 'single-use-nonce',
    origin: 'https://good-slice.vercel.app',
    expiresAt: new Date(now.getTime() + 60_000),
    consumedAt: null as Date | null,
  };
  let claimed = false;
  const walletAuthChallenge = {
    updateMany: async ({ where, data }: {
      where: { nonce: string; consumedAt: null; expiresAt: { gt: Date } };
      data: { consumedAt: Date };
    }) => {
      const eligible = !claimed
        && where.nonce === challenge.nonce
        && where.consumedAt === null
        && challenge.expiresAt > where.expiresAt.gt;
      if (!eligible) return { count: 0 };
      claimed = true;
      challenge.consumedAt = data.consumedAt;
      return { count: 1 };
    },
    findUnique: async ({ where }: { where: { nonce: string } }) => where.nonce === challenge.nonce ? challenge : null,
  };
  const store = new PrismaWalletChallengeStore({
    $transaction: async (operation: (transaction: { walletAuthChallenge: typeof walletAuthChallenge }) => Promise<unknown>) => operation({ walletAuthChallenge }),
  } as never);

  const results = await Promise.all([store.consume(challenge.nonce, now), store.consume(challenge.nonce, now)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter(result => result === null).length, 1);
  assert.equal(challenge.consumedAt, now);
});

test('rejects stale wallet sessions immediately after player suspension or deletion', async () => {
  const principal = {
    subject: '0x0000000000000000000000000000000000000001',
    kind: 'player' as const,
    playerId: '00000000-0000-4000-8000-000000000001',
    roles: [] as const,
  };
  const token = createWalletSessionToken(principal, 's'.repeat(32), 1_000);
  let status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' = 'ACTIVE';
  const verifier = new WalletSessionTokenVerifier('s'.repeat(32), async () => ({ playerId: principal.playerId, status }), () => 2_000);
  assert.equal((await verifier.verify(token))?.playerId, principal.playerId);
  status = 'SUSPENDED';
  assert.equal(await verifier.verify(token), null);
  status = 'DELETED';
  assert.equal(await verifier.verify(token), null);
});

test('uses half-open activity windows at exact schedule boundaries', () => {
  const startsAt = new Date('2026-10-29T10:00:00.000Z');
  const endsAt = new Date('2026-10-29T11:00:00.000Z');
  assert.equal(isWithinActiveWindow(startsAt, endsAt, new Date(startsAt.getTime() - 1)), false);
  assert.equal(isWithinActiveWindow(startsAt, endsAt, startsAt), true);
  assert.equal(isWithinActiveWindow(startsAt, endsAt, new Date(endsAt.getTime() - 1)), true);
  assert.equal(isWithinActiveWindow(startsAt, endsAt, endsAt), false);
  assert.equal(isWithinActiveWindow(null, null, endsAt), true);
});

test('preserves exact 78-digit reward amounts and rejects numeric JSON amounts', () => {
  const amount = '9'.repeat(78);
  const challenge = createChallengeSchema.parse({
    slug: 'precision-challenge',
    title: 'Precision challenge',
    description: 'Exact amount',
    rewardAmount: amount,
    rules: [{ eventType: 'targets_cut', operator: 'gte', counter: 'targets_cut', threshold: 1 }],
  });
  const bounty = createBountySchema.parse({
    slug: 'precision-bounty',
    title: 'Precision bounty',
    description: 'Exact amount',
    rewardAmount: amount,
  });
  assert.equal(challenge.rewardAmount, amount);
  assert.equal(bounty.rewardAmount, amount);
  assert.throws(() => createBountySchema.parse({
    slug: 'unsafe-number', title: 'Unsafe', description: 'Unsafe number', rewardAmount: Number.MAX_SAFE_INTEGER + 1,
  }));
  assert.throws(() => createBountySchema.parse({
    slug: 'too-large', title: 'Too large', description: 'Too many digits', rewardAmount: `1${'0'.repeat(78)}`,
  }));
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
    update: { email: 'admin@example.com' },
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

test('reflects request origins when the CORS wildcard is explicitly configured', async () => {
  const server = createApp({
    environment: 'test',
    port: 0,
    host: '127.0.0.1',
    corsOrigins: ['*'],
    maxRequestBytes: 100_000,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 20,
    adminEmails: [],
    goodDollarEnvironment: 'development',
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/session`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://frontend.example.com',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://frontend.example.com');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  server.close();
  await once(server, 'close');
});

test('completes administrator login through the CSRF-protected cookie route', async () => {
  const server = createApp({
    environment: 'test', port: 0, host: '127.0.0.1', corsOrigins: ['https://console.example'],
    maxRequestBytes: 100_000, rateLimitWindowMs: 60_000, rateLimitMaxRequests: 20, adminEmails: [], goodDollarEnvironment: 'development',
  }, {
    adminAuth: {
      login: async () => ({ token: 'opaque-admin-token', principal: { subject: 'admin-subject', kind: 'administrator', email: 'admin@example.com', roles: ['admin'] } }),
      logout: async () => undefined,
      verify: async () => null,
    },
  } as never).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { Origin: 'https://console.example', 'Content-Type': 'application/json', 'X-Slyyce-CSRF': '1' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'a secure password' }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /slyce_admin_session=/);
  assert.deepEqual((await response.json() as { data: unknown }).data, {
    status: 'authenticated', kind: 'administrator', subject: 'admin-subject', email: 'admin@example.com',
  });
  server.close();
  await once(server, 'close');
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
    corsOrigins: ['https://slyyce.example'],
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
  assert.deepEqual(await health.json(), { status: 'ok', service: 'slyyce-backend' });

  const cors = await fetch(`${baseUrl}/healthz`, { headers: { Origin: 'https://slyyce.example' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://slyyce.example');

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
    const challengeEvents: Array<Record<string, number | boolean>> = [];
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
      challengeService: {
        evaluateGameplay: async (_playerId: string, event: Record<string, number | boolean>) => {
          challengeEvents.push(event);
          return [];
        },
      } as never,
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
      body: JSON.stringify({
        inputDigest: digestReplayInputs(replayInputs),
        score: 0,
        replayInputs,
        breakdown: { targetsCut: 999, bestCombo: 999, bombsCut: 0 },
      }),
    });
    assert.equal(finish.status, 200);
    const finished = (await finish.json() as { data: { status: string; verificationStatus: string } }).data;
    assert.deepEqual(finished, { status: 'verified', scoreId, score: 0, verificationStatus: 'VERIFIED' });
    assert.deepEqual(challengeEvents, [{
      targetsCut: 0,
      bestCombo: 0,
      bombsCut: 0,
      score: 0,
      roundCompleted: true,
    }]);
    server.close();
    await once(server, 'close');
});
