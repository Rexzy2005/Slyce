import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/server.js';
import { walletVerifyRequestSchema } from '../src/api/contracts.js';
import { buildDailyGrowth, PlayerService, type PlayerGrowth } from '../src/player-service.js';
import { createWalletChallenge, verifyWalletChallenge, walletAuthMessage, type SignInMethod, type WalletChallenge } from '../src/wallet-auth.js';
import type { AuthenticatedPrincipal } from '../src/security.js';

const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const origin = 'https://www.slyyce.xyz';

function challengeStore(challenge: WalletChallenge) {
  let used = false;
  return { create: async () => undefined, consume: async (nonce: string) => { if (used || nonce !== challenge.nonce) return null; used = true; return challenge; } };
}

function playerStore() {
  const created: Array<{ address: string; method: SignInMethod | undefined }> = [];
  return { created, findOrCreate: async (address: `0x${string}`, _chainId: number, method?: SignInMethod) => { created.push({ address, method }); return '00000000-0000-4000-8000-000000000001'; } };
}

await it('signs up a wallet with its sign-in method after a valid signature', async () => {
  const challenge = createWalletChallenge(account.address.toLowerCase() as `0x${string}`, 42220, origin);
  const signature = await account.signMessage({ message: walletAuthMessage(challenge) });
  const players = playerStore();
  const result = await verifyWalletChallenge(challengeStore(challenge), { address: challenge.address, nonce: challenge.nonce, signature, origin, signInMethod: 'email' }, 'x'.repeat(32), players);
  assert.equal(result.playerId, '00000000-0000-4000-8000-000000000001');
  assert.deepEqual(players.created, [{ address: challenge.address, method: 'email' }]);
});

await it('rejects a wrong signature and a replayed challenge', async () => {
  const challenge = createWalletChallenge(account.address.toLowerCase() as `0x${string}`, 42220, origin);
  const other = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
  const forged = await other.signMessage({ message: walletAuthMessage(challenge) });
  const store = challengeStore(challenge);
  await assert.rejects(() => verifyWalletChallenge(store, { address: challenge.address, nonce: challenge.nonce, signature: forged, origin }, 'x'.repeat(32), playerStore()), /signature is invalid/);
  const signature = await account.signMessage({ message: walletAuthMessage(challenge) });
  await assert.rejects(() => verifyWalletChallenge(store, { address: challenge.address, nonce: challenge.nonce, signature, origin }, 'x'.repeat(32), playerStore()), /invalid or expired/);
});

await it('accepts smart-account signatures through the injected verifier', async () => {
  const challenge = createWalletChallenge(account.address.toLowerCase() as `0x${string}`, 42220, origin);
  const smartSignature = `0x${'ab'.repeat(400)}` as `0x${string}`;
  const seen: string[] = [];
  const players = playerStore();
  await verifyWalletChallenge(challengeStore(challenge), { address: challenge.address, nonce: challenge.nonce, signature: smartSignature, origin, signInMethod: 'social' }, 'x'.repeat(32), players, new Date(), async ({ signature }) => { seen.push(signature); return true; });
  assert.deepEqual(seen, [smartSignature]);
  assert.equal(players.created[0]!.method, 'social');
  const base = { address: account.address, chainId: 42220, origin, nonce: 'n'.repeat(24) };
  assert.ok(walletVerifyRequestSchema.safeParse({ ...base, signature: smartSignature }).success);
  assert.ok(!walletVerifyRequestSchema.safeParse({ ...base, signature: `0x${'ab'.repeat(64)}` }).success, 'shorter than a wallet signature');
  assert.ok(!walletVerifyRequestSchema.safeParse({ ...base, signature: `0x${'a'.repeat(131)}` }).success, 'odd length');
  assert.ok(!walletVerifyRequestSchema.safeParse({ ...base, signature: `0x${'ab'.repeat(65)}`, signInMethod: 'phone' }).success);
});

await it('builds a gap-free daily growth series with a running total', () => {
  const daily = buildDailyGrowth([{ day: '2026-10-29', count: 2 }, { day: '2026-10-31', count: 3 }], 10, 4, new Date('2026-10-31T15:00:00Z'));
  assert.deepEqual(daily, [
    { date: '2026-10-28', signUps: 0, total: 10 },
    { date: '2026-10-29', signUps: 2, total: 12 },
    { date: '2026-10-30', signUps: 0, total: 12 },
    { date: '2026-10-31', signUps: 3, total: 15 },
  ]);
});

await it('serves sign-up growth to administrators only', async () => {
  const growth: PlayerGrowth = { total: 15, last24h: 3, last7d: 5, last30d: 15, byMethod: { email: 9, social: 1, wallet: 4, unknown: 1 }, daily: buildDailyGrowth([], 15, 7, new Date()) };
  const days: number[] = [];
  const service = new PlayerService({ findById: async () => null, list: async () => ({ items: [], nextCursor: null }), growth: async value => { days.push(value); return growth; } }, { ensure: async () => undefined });
  let principal: AuthenticatedPrincipal = { kind: 'administrator', subject: 'admin', roles: ['admin'] };
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { verifier: { verify: async () => principal }, playerService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/players/growth`;
  const auth = { headers: { Authorization: 'Bearer token' } };
  try {
    const response = await fetch(`${url}?days=7`, auth);
    assert.equal(response.status, 200);
    const body = await response.json() as { data: PlayerGrowth };
    assert.equal(body.data.total, 15);
    assert.equal(body.data.daily.length, 7);
    assert.deepEqual(days, [7]);
    assert.equal((await fetch(`${url}?days=999`, auth)).status, 400);
    principal = { kind: 'player', subject: 'p', playerId: '00000000-0000-4000-8000-000000000002', roles: [] };
    assert.equal((await fetch(url, auth)).status, 403);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
