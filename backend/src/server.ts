import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadConfig, type BackendConfig } from './config.js';
import { logger } from './logger.js';
import { applyCors, authenticate, FixedWindowRateLimiter, requestContentLength, type TokenVerifier } from './security.js';
import { apiPrefix, adminPlayerListResponseSchema, createGameSessionSchema, finishGameSessionSchema, gameSessionSchema, goodDollarVerificationCheckSchema, goodDollarVerificationCountSchema, goodDollarVerificationSchema, leaderboardQuerySchema, leaderboardResponseSchema, paginationQuerySchema, playerProfileSchema, scoreSubmissionResultSchema, sessionResponseSchema, walletChallengeRequestSchema, walletChallengeResponseSchema, walletVerifyRequestSchema, walletVerifyResponseSchema } from './api/contracts.js';
import { createPrismaClient } from './database.js';
import { createSupabaseTokenVerifier } from './supabase-auth.js';
import { PrismaPrincipalStore, type PrincipalStore } from './principal-store.js';
import { PrismaPlayerRecordRepository, PlayerService } from './player-service.js';
import { requireAdministrator } from './security.js';
import { checkGoodDollarAddress, createGoodDollarPublicClient, goodDollarIdentityAddress, PrismaGoodDollarRecordStore, type GoodDollarRecordStore } from './gooddollar-service.js';
import { LeaderboardService, PrismaLeaderboardRepository } from './leaderboard-service.js';
import { createVerifiedFruitSliceRules, GameplayService, PrismaGameplaySessionRepository } from './gameplay-service.js';
import { PrismaPendingScoreStore, ScoreVerificationService, VerifiedFruitSliceVerifier } from './gameplay-verifier.js';
import { requireIdempotencyKey } from './api/validation.js';
import { createWalletChallenge, PrismaWalletChallengeStore, PrismaWalletPlayerStore, verifyWalletChallenge, walletAuthMessage, WalletSessionTokenVerifier } from './wallet-auth.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(payload));
  response.end(payload);
}

function methodNotAllowed(response: ServerResponse): void {
  response.setHeader('Allow', 'GET, POST');
  sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'The requested method is not supported for this endpoint.' } } satisfies ErrorResponse);
}

interface AppDependencies {
  verifier?: TokenVerifier;
  principalStore?: PrincipalStore;
  playerService?: PlayerService;
  goodDollarClient?: Parameters<typeof checkGoodDollarAddress>[0];
  goodDollarRecords?: GoodDollarRecordStore;
  goodDollarEnvironment?: 'production' | 'staging' | 'development';
  goodDollarIdentityAddress?: `0x${string}`;
  leaderboardService?: LeaderboardService;
  gameplayService?: GameplayService;
  scoreVerificationService?: ScoreVerificationService;
  walletChallenges?: PrismaWalletChallengeStore;
  walletPlayers?: PrismaWalletPlayerStore;
  walletVerifier?: TokenVerifier;
  walletVerifierSecret?: string;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function route(request: IncomingMessage, response: ServerResponse, dependencies: AppDependencies): Promise<void> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/healthz') {
    if (request.method !== 'GET') return methodNotAllowed(response);
    return sendJson(response, 200, { status: 'ok', service: 'slyce-backend' });
  }
  if (pathname === '/readyz') {
    if (request.method !== 'GET') return methodNotAllowed(response);
    return sendJson(response, 503, { status: 'not_ready', checks: { database: 'not_configured' } });
  }
  if (pathname === `${apiPrefix}/session`) {
    if (request.method !== 'GET') return methodNotAllowed(response);
    if (!dependencies.verifier || !dependencies.principalStore) {
      return sendJson(response, 503, { error: { code: 'auth_not_configured', message: 'Authentication is not configured.' } } satisfies ErrorResponse);
    }
    const principal = await authenticate(request, dependencies.verifier);
    await dependencies.principalStore.ensure(principal);
    const body = {
      status: 'authenticated' as const,
      kind: principal.kind,
      subject: principal.subject,
      ...(principal.playerId ? { playerId: principal.playerId } : {}),
      ...(principal.email ? { email: principal.email } : {}),
    };
    return sendJson(response, 200, { data: sessionResponseSchema.parse(body) });
  }
  if (pathname === `${apiPrefix}/auth/wallet/challenge`) {
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!dependencies.walletChallenges) return sendJson(response, 503, { error: { code: 'wallet_auth_not_configured', message: 'Wallet authentication is not configured.' } } satisfies ErrorResponse);
    const input = walletChallengeRequestSchema.parse(await readJsonBody(request));
    if (input.chainId !== 42220 || input.origin !== request.headers.origin) {
      return sendJson(response, 400, { error: { code: 'invalid_wallet_origin', message: 'The wallet origin or chain is not accepted.' } } satisfies ErrorResponse);
    }
    const challenge = createWalletChallenge(input.address.toLowerCase() as `0x${string}`, input.chainId, input.origin);
    await dependencies.walletChallenges.create(challenge);
    return sendJson(response, 201, { data: walletChallengeResponseSchema.parse({
      address: challenge.address,
      chainId: challenge.chainId,
      nonce: challenge.nonce,
      message: walletAuthMessage(challenge),
      expiresAt: challenge.expiresAt.toISOString(),
    }) });
  }
  if (pathname === `${apiPrefix}/auth/wallet/verify`) {
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!dependencies.walletChallenges || !dependencies.walletPlayers || !dependencies.walletVerifierSecret) {
      return sendJson(response, 503, { error: { code: 'wallet_auth_not_configured', message: 'Wallet authentication is not configured.' } } satisfies ErrorResponse);
    }
    const input = walletVerifyRequestSchema.parse(await readJsonBody(request));
    if (input.chainId !== 42220 || input.origin !== request.headers.origin) {
      return sendJson(response, 400, { error: { code: 'invalid_wallet_origin', message: 'The wallet origin or chain is not accepted.' } } satisfies ErrorResponse);
    }
    try {
      const result = await verifyWalletChallenge(dependencies.walletChallenges, {
        address: input.address.toLowerCase() as `0x${string}`,
        nonce: input.nonce,
        signature: input.signature as `0x${string}`,
        origin: input.origin,
      }, dependencies.walletVerifierSecret, dependencies.walletPlayers);
      return sendJson(response, 200, { data: walletVerifyResponseSchema.parse(result) });
    } catch (error) {
      return sendJson(response, 401, { error: { code: 'wallet_auth_failed', message: error instanceof Error ? error.message : 'Wallet authentication failed.' } } satisfies ErrorResponse);
    }
  }
  if (pathname === `${apiPrefix}/players/me`) {
    if (request.method !== 'GET') return methodNotAllowed(response);
    if (!dependencies.verifier || !dependencies.playerService) {
      return sendJson(response, 503, { error: { code: 'player_service_not_configured', message: 'The player service is not configured.' } } satisfies ErrorResponse);
    }
    const principal = await authenticate(request, dependencies.verifier);
    if (principal.kind !== 'player' || !principal.playerId) {
      return sendJson(response, 403, { error: { code: 'forbidden', message: 'Player access is required.' } } satisfies ErrorResponse);
    }
    const profile = await dependencies.playerService.getProfile(principal.playerId);
    if (!profile) return sendJson(response, 404, { error: { code: 'not_found', message: 'The player record was not found.' } } satisfies ErrorResponse);
    return sendJson(response, 200, { data: playerProfileSchema.parse(profile) });
  }
  if (pathname === `${apiPrefix}/admin/players`) {
    if (request.method !== 'GET') return methodNotAllowed(response);
    if (!dependencies.verifier || !dependencies.playerService) {
      return sendJson(response, 503, { error: { code: 'player_service_not_configured', message: 'The player service is not configured.' } } satisfies ErrorResponse);
    }
    const principal = await authenticate(request, dependencies.verifier);
    requireAdministrator(principal);
    const query = paginationQuerySchema.parse(Object.fromEntries(new URL(request.url ?? '/', 'http://localhost').searchParams));
    const result = await dependencies.playerService.listPlayers(query);
    return sendJson(response, 200, adminPlayerListResponseSchema.parse({
      data: result.items,
      pagination: { nextCursor: result.nextCursor, limit: query.limit },
    }));
  }
  if (pathname === `${apiPrefix}/gooddollar/verification/check`) {
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!dependencies.goodDollarClient || !dependencies.goodDollarRecords || !dependencies.goodDollarEnvironment || !dependencies.goodDollarIdentityAddress) {
      return sendJson(response, 503, { error: { code: 'gooddollar_not_configured', message: 'GoodDollar verification is not configured.' } } satisfies ErrorResponse);
    }
    const input = goodDollarVerificationCheckSchema.parse(await readJsonBody(request));
    const record = await checkGoodDollarAddress(dependencies.goodDollarClient, dependencies.goodDollarIdentityAddress, input.address as `0x${string}`);
    await dependencies.goodDollarRecords.upsert({ ...record, environment: dependencies.goodDollarEnvironment });
    return sendJson(response, 200, { data: goodDollarVerificationSchema.parse({
      address: record.address,
      state: record.state,
      rootIdentityReference: record.rootIdentityReference,
      lastAuthenticatedAt: record.lastAuthenticatedAt?.toISOString() ?? null,
    }) });
  }
  if (pathname === `${apiPrefix}/admin/gooddollar/verification-count`) {
    if (request.method !== 'GET') return methodNotAllowed(response);
    if (!dependencies.verifier || !dependencies.goodDollarRecords || !dependencies.goodDollarEnvironment) {
      return sendJson(response, 503, { error: { code: 'gooddollar_not_configured', message: 'GoodDollar verification is not configured.' } } satisfies ErrorResponse);
    }
    requireAdministrator(await authenticate(request, dependencies.verifier));
    return sendJson(response, 200, { data: goodDollarVerificationCountSchema.parse({
      environment: dependencies.goodDollarEnvironment,
      verifiedCount: await dependencies.goodDollarRecords.countVerified(dependencies.goodDollarEnvironment),
    }) });
  }
  if (pathname === `${apiPrefix}/leaderboards`) {
    if (request.method !== 'GET') return methodNotAllowed(response);
    if (!dependencies.leaderboardService) {
      return sendJson(response, 503, { error: { code: 'leaderboard_not_configured', message: 'The leaderboard service is not configured.' } } satisfies ErrorResponse);
    }
    const query = leaderboardQuerySchema.parse(Object.fromEntries(new URL(request.url ?? '/', 'http://localhost').searchParams));
    const result = await dependencies.leaderboardService.list({
      scope: query.scope,
      ...(query.gameMode ? { gameMode: query.gameMode } : {}),
      limit: query.limit,
      ...(query.cursor ? { cursor: Number(query.cursor) } : {}),
    });
    return sendJson(response, 200, leaderboardResponseSchema.parse({
      data: result.items,
      pagination: { nextCursor: result.nextCursor === null ? null : String(result.nextCursor), limit: query.limit },
    }));
  }
  if (pathname === `${apiPrefix}/gameplay/rounds` && request.method === 'POST') {
    if (!dependencies.walletVerifier || !dependencies.gameplayService) {
      return sendJson(response, 503, { error: { code: 'gameplay_not_configured', message: 'Gameplay is not configured.' } } satisfies ErrorResponse);
    }
    const principal = await authenticate(request, dependencies.walletVerifier);
    const input = createGameSessionSchema.parse(await readJsonBody(request));
    if (input.gameMode !== 'verified-fruit-slice' || input.rulesVersion !== 'verified-fruit-slice-v1') {
      return sendJson(response, 400, { error: { code: 'unsupported_ruleset', message: 'Only the approved verified fruit-slice ruleset is available.' } } satisfies ErrorResponse);
    }
    const session = await dependencies.gameplayService.createSession(principal, createVerifiedFruitSliceRules());
    return sendJson(response, 201, { data: gameSessionSchema.parse({
      id: session.id,
      gameMode: session.gameMode,
      status: session.status,
      rulesVersion: session.rulesVersion,
      seed: session.seed,
      expiresAt: session.expiresAt.toISOString(),
    }) });
  }
  const finishMatch = pathname.match(new RegExp(`^${apiPrefix}/gameplay/rounds/([^/]+)/finish$`));
  if (finishMatch && request.method === 'POST') {
    if (!dependencies.walletVerifier || !dependencies.gameplayService) {
      return sendJson(response, 503, { error: { code: 'gameplay_not_configured', message: 'Gameplay is not configured.' } } satisfies ErrorResponse);
    }
    const principal = await authenticate(request, dependencies.walletVerifier);
    const input = finishGameSessionSchema.parse(await readJsonBody(request));
    const rawIdempotencyKey = request.headers['idempotency-key'];
    const idempotencyKey = requireIdempotencyKey(Array.isArray(rawIdempotencyKey) ? rawIdempotencyKey[0] : rawIdempotencyKey);
    const result = await dependencies.gameplayService.submitScore(principal, finishMatch[1]!, createVerifiedFruitSliceRules(), {
      inputDigest: input.inputDigest,
      score: input.score,
      ...(input.breakdown ? { breakdown: input.breakdown } : {}),
      ...(input.replayInputs ? { replayInputs: input.replayInputs } : {}),
    }, idempotencyKey);
    if (result.status === 'rejected' || result.status === 'accepted' && !dependencies.scoreVerificationService) {
      return sendJson(response, result.status === 'rejected' ? 400 : 202, { data: scoreSubmissionResultSchema.parse(result) });
    }
    if (result.status === 'accepted' && dependencies.scoreVerificationService) {
      const verification = await dependencies.scoreVerificationService.verifyPending(result.scoreId);
      if (verification.status === 'verified') {
        return sendJson(response, 200, { data: scoreSubmissionResultSchema.parse({ status: 'verified', scoreId: result.scoreId, score: verification.score, verificationStatus: 'VERIFIED' }) });
      }
      return sendJson(response, 400, { data: scoreSubmissionResultSchema.parse({ status: 'rejected', reason: verification.reason }) });
    }
  }
  return sendJson(response, 404, { error: { code: 'not_found', message: 'The requested route was not found.' } } satisfies ErrorResponse);
}

export function createApp(config: BackendConfig = loadConfig(), dependencies: AppDependencies = {}): Server {
  const limiter = new FixedWindowRateLimiter(config.rateLimitWindowMs, config.rateLimitMaxRequests);
  return createServer((request, response) => {
    try {
      applyCors(response, request.headers.origin, config.corsOrigins);
      if (request.method === 'OPTIONS') return response.end();
      if (requestContentLength(request) > config.maxRequestBytes) {
        return sendJson(response, 413, { error: { code: 'request_too_large', message: 'The request body is too large.' } } satisfies ErrorResponse);
      }
      const forwardedFor = request.headers['x-forwarded-for'];
      const clientKey = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0])?.trim() || request.socket.remoteAddress || 'unknown';
      if (!limiter.allow(clientKey)) {
        response.setHeader('Retry-After', Math.ceil(config.rateLimitWindowMs / 1000));
        return sendJson(response, 429, { error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } } satisfies ErrorResponse);
      }
      void route(request, response, dependencies).catch(error => {
        logger.error('Unhandled route error', { error: error instanceof Error ? error.message : 'unknown' });
        if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
          return sendJson(response, error.statusCode, { error: { code: 'authentication_error', message: error.message } } satisfies ErrorResponse);
        }
        if (!response.headersSent) sendJson(response, 500, { error: { code: 'internal_error', message: 'The server could not complete the request.' } } satisfies ErrorResponse);
        else response.destroy();
      });
    } catch (error) {
      logger.error('Unhandled request error', { error: error instanceof Error ? error.message : 'unknown' });
      if (!response.headersSent) sendJson(response, 500, { error: { code: 'internal_error', message: 'The server could not complete the request.' } } satisfies ErrorResponse);
      else response.destroy();
    }
  });
}

export function startServer(config: BackendConfig = loadConfig()): Server {
  const prisma = createPrismaClient();
  const goodDollarClient = createGoodDollarPublicClient(config);
  const server = createApp(config, {
    verifier: createSupabaseTokenVerifier(config),
    principalStore: new PrismaPrincipalStore(prisma),
    playerService: new PlayerService(new PrismaPlayerRecordRepository(prisma), new PrismaPrincipalStore(prisma)),
    ...(goodDollarClient && goodDollarIdentityAddress(config) ? {
      goodDollarClient,
      goodDollarRecords: new PrismaGoodDollarRecordStore(prisma),
      goodDollarEnvironment: config.goodDollarEnvironment,
      goodDollarIdentityAddress: goodDollarIdentityAddress(config) as `0x${string}`,
    } : {}),
    leaderboardService: new LeaderboardService(new PrismaLeaderboardRepository(prisma)),
    gameplayService: new GameplayService(new PrismaGameplaySessionRepository(prisma)),
    scoreVerificationService: new ScoreVerificationService(new PrismaPendingScoreStore(prisma), new VerifiedFruitSliceVerifier()),
    walletChallenges: new PrismaWalletChallengeStore(prisma),
    walletPlayers: new PrismaWalletPlayerStore(prisma),
    ...(config.authSessionSecret ? {
      walletVerifierSecret: config.authSessionSecret,
      walletVerifier: new WalletSessionTokenVerifier(config.authSessionSecret, async address => (await prisma.wallet.findFirst({ where: { address: address.toLowerCase() }, select: { playerId: true } }))?.playerId ?? null),
    } : {}),
  });
  server.listen(config.port, config.host, () => {
    const address = server.address();
    logger.info('Backend listening', { host: config.host, port: typeof address === 'object' && address ? address.port : config.port, environment: config.environment });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    startServer();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid backend configuration';
    logger.error('Backend startup failed', { error: message });
    process.exitCode = 1;
  }
}
