import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { getAddress, recoverTypedDataAddress } from 'viem';
import { createApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { plausibilityProblem, ScoreSigningService, ticketMaxAgeMs } from '../src/score-signing-service.js';

const key = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const arcade = '0x00000000000000000000000000000000000000A1';
const tournament = '0x00000000000000000000000000000000000000B2';
const player = '0x00000000000000000000000000000000000000C3';
const config = { privateKey: key, chainId: 42220, arcade, tournament } as const;

await it('accepts real arena results and rejects impossible ones', () => {
  // A real saved game from Celo: 88 fruit, best combo 49, score 1,125.
  assert.equal(plausibilityProblem({ score: 1125, bestCombo: 49, fruits: 88 }, 40), null);
  assert.equal(plausibilityProblem({ score: 0, bestCombo: 0, fruits: 0 }, 0), null);
  assert.match(plausibilityProblem({ score: 1001, bestCombo: 0, fruits: 100 }, 60)!, /multiple of 5/);
  assert.match(plausibilityProblem({ score: 5000, bestCombo: 0, fruits: 100 }, 60)!, /match fruit/);
  assert.match(plausibilityProblem({ score: 100, bestCombo: 3, fruits: 10 }, 60)!, /match fruit/);
  assert.match(plausibilityProblem({ score: 50, bestCombo: 6, fruits: 5 }, 60)!, /best combo/);
  assert.match(plausibilityProblem({ score: 2000, bestCombo: 0, fruits: 200 }, 10)!, /time played/);
});

await it('signs EIP-712 results the contracts can recover, bound to player, ticket and tournament', async () => {
  let now = 1_800_000_000_000;
  const service = new ScoreSigningService(config, () => now);
  const issued = service.issue(player);
  now += 60_000;
  const signed = await service.finish(player, issued.token, { score: 600, bestCombo: 3, fruits: 57 }, 7n);
  assert.equal(signed.ticket, issued.ticket);
  const domain = (verifyingContract: `0x${string}`) => ({ name: 'Slyyce', version: '1', chainId: 42220, verifyingContract: getAddress(verifyingContract.toLowerCase()) });
  const signedPlayer = getAddress(player.toLowerCase());
  const game = await recoverTypedDataAddress({
    domain: domain(arcade), primaryType: 'Game', signature: signed.gameSignature,
    types: { Game: [{ name: 'player', type: 'address' }, { name: 'ticket', type: 'uint256' }, { name: 'score', type: 'uint32' }, { name: 'bestCombo', type: 'uint32' }, { name: 'fruits', type: 'uint32' }, { name: 'deadline', type: 'uint64' }] },
    message: { player: signedPlayer, ticket: BigInt(issued.ticket), score: 600, bestCombo: 3, fruits: 57, deadline: BigInt(signed.deadline) },
  });
  assert.equal(game, service.signerAddress);
  const score = await recoverTypedDataAddress({
    domain: domain(tournament), primaryType: 'TournamentScore', signature: signed.tournamentSignature!,
    types: { TournamentScore: [{ name: 'player', type: 'address' }, { name: 'id', type: 'uint256' }, { name: 'ticket', type: 'uint256' }, { name: 'score', type: 'uint32' }, { name: 'deadline', type: 'uint64' }] },
    message: { player: signedPlayer, id: 7n, ticket: BigInt(issued.ticket), score: 600, deadline: BigInt(signed.deadline) },
  });
  assert.equal(score, service.signerAddress);
  assert.equal(signed.deadline, Math.floor(now / 1000) + 3600);
});

await it('rejects forged, foreign, expired and implausible tickets', async () => {
  let now = 1_800_000_000_000;
  const service = new ScoreSigningService(config, () => now);
  const issued = service.issue(player);
  const [payload, mac] = issued.token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), i: now - 3_600_000 })).toString('base64url');
  await assert.rejects(service.finish(player, `${forged}.${mac}`, { score: 10, bestCombo: 0, fruits: 1 }), { code: 'invalid_ticket' });
  await assert.rejects(service.finish(arcade, issued.token, { score: 10, bestCombo: 0, fruits: 1 }), { code: 'invalid_ticket' });
  await assert.rejects(new ScoreSigningService({ ...config, privateKey: `0x${'1'.repeat(64)}` }).finish(player, issued.token, { score: 10, bestCombo: 0, fruits: 1 }), { code: 'invalid_ticket' });
  now += 2_000;
  await assert.rejects(service.finish(player, issued.token, { score: 5000, bestCombo: 0, fruits: 400 }), { code: 'implausible_score' });
  now += ticketMaxAgeMs;
  await assert.rejects(service.finish(player, issued.token, { score: 10, bestCombo: 0, fruits: 1 }), { code: 'expired_ticket' });
});

await it('serves tickets and signatures over HTTP and reports rejections as 422', async () => {
  const service = new ScoreSigningService(config);
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { scoreSigningService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/score-tickets`;
  const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const ticket = await post(base, { address: player });
    assert.equal(ticket.status, 201);
    const { data } = await ticket.json() as { data: { token: string } };
    const finished = await post(`${base}/finish`, { address: player, token: data.token, score: 30, bestCombo: 0, fruits: 3 });
    assert.equal(finished.status, 200);
    assert.ok(((await finished.json()) as { data: { gameSignature: string } }).data.gameSignature.startsWith('0x'));
    const rejected = await post(`${base}/finish`, { address: player, token: data.token, score: 90_000, bestCombo: 0, fruits: 6_000 });
    assert.equal(rejected.status, 422);
    assert.equal(((await rejected.json()) as { error: { code: string } }).error.code, 'implausible_score');
    assert.equal((await post(base, { address: 'nope' })).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

await it('reads score signing configuration only with a valid key and arcade address', () => {
  assert.equal(loadConfig({}).scoreSigning, undefined);
  const env = { GOODDOLLAR_RPC_URL: 'https://forno.celo.org', SLYYCE_ARCADE_ADDRESS: arcade, SLYYCE_CONTRACTS_START_BLOCK: '1', SCORE_SIGNER_PRIVATE_KEY: key };
  assert.deepEqual(loadConfig(env).scoreSigning, { privateKey: key, chainId: 42220, arcade });
  assert.throws(() => loadConfig({ ...env, SCORE_SIGNER_PRIVATE_KEY: '0x1234' }), /SCORE_SIGNER_PRIVATE_KEY/);
  assert.throws(() => loadConfig({ SCORE_SIGNER_PRIVATE_KEY: key }), /SLYYCE_ARCADE_ADDRESS/);
});

await it('still signs a long round played on a ticket fetched well before it started', async () => {
  let now = 1_800_000_000_000;
  const service = new ScoreSigningService({ privateKey: key, chainId: 42220, arcade, tournament }, () => now);
  const issued = service.issue(player);
  now += 45 * 60_000; // ticket waited, then a long, high-scoring round
  assert.ok((await service.finish(player, issued.token, { score: 10470, bestCombo: 49, fruits: 700 })).gameSignature);
});
