import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.js';
import { ExtraLifeService, NoExtraLives, type ExtraLifeStore } from '../src/extra-life-service.js';
import { ScoreSigningService } from '../src/score-signing-service.js';

const key = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const player = '0x00000000000000000000000000000000000000C3';
const config = { privateKey: key, chainId: 42220, arcade: '0x00000000000000000000000000000000000000A1', tournament: '0x00000000000000000000000000000000000000B2' } as const;

class MemoryStore implements ExtraLifeStore {
  rows: { address: string; useNumber: number; ticket: string }[] = [];
  async usedCount(address: string) { return this.rows.filter(row => row.address === address).length; }
  async record(address: string, useNumber: number, ticket: string) {
    if (this.rows.some(row => row.address === address && row.useNumber === useNumber)) return false;
    this.rows.push({ address, useNumber, ticket }); return true;
  }
  async ticketUsed(ticket: string) { return this.rows.some(row => row.ticket === ticket); }
}
function setup(packs: bigint) {
  const store = new MemoryStore();
  const signer = new ScoreSigningService(config, Date.now, ticket => store.ticketUsed(ticket));
  return { store, signer, lives: new ExtraLifeService(store, async () => packs, signer) };
}

await it('gives 3 lives per pack and spends them one at a time', async () => {
  const { lives, signer } = setup(2n);
  assert.deepEqual(await lives.balance(player), { owned: 6, used: 0, available: 6 });
  const { token } = signer.issue(player);
  assert.deepEqual(await lives.use(player, token), { owned: 6, used: 1, available: 5 });
  assert.deepEqual(await lives.use(player.toLowerCase() as `0x${string}`, token), { owned: 6, used: 2, available: 4 });
});

await it('refuses when none are left, for a foreign ticket, and never double-spends concurrently', async () => {
  const { lives, signer, store } = setup(1n);
  const { token } = signer.issue(player);
  await assert.rejects(lives.use('0x00000000000000000000000000000000000000D4', token), { code: 'invalid_ticket' });
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => lives.use(player, token)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal(store.rows.length, 3);
  await assert.rejects(lives.use(player, token), NoExtraLives);
});

await it('keeps rounds continued with an extra life out of tournaments', async () => {
  const { lives, signer } = setup(1n);
  const plain = signer.issue(player), continued = signer.issue(player);
  await lives.use(player, continued.token);
  const result = { score: 30, bestCombo: 0, fruits: 3 };
  assert.ok((await signer.finish(player, plain.token, result, 1n)).tournamentSignature);
  assert.ok((await signer.finish(player, continued.token, result)).gameSignature, 'still saves normally');
  await assert.rejects(signer.finish(player, continued.token, result, 1n), { code: 'extra_life_round' });
});

await it('serves balances and uses over HTTP', async () => {
  const { lives, signer } = setup(1n);
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { scoreSigningService: signer, extraLifeService: lives });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/extra-lives`;
  const use = (token: string) => fetch(`${base}/use`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: player, token }) });
  try {
    assert.deepEqual(((await (await fetch(`${base}?address=${player}`)).json()) as { data: unknown }).data, { owned: 3, used: 0, available: 3 });
    const { token } = signer.issue(player);
    for (let i = 0; i < 3; i++) assert.equal((await use(token)).status, 200);
    const empty = await use(token);
    assert.equal(empty.status, 409);
    assert.equal(((await empty.json()) as { error: { code: string } }).error.code, 'no_extra_lives');
    assert.equal((await use('bad.token-value')).status, 422);
    assert.equal((await fetch(`${base}?address=nope`)).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
