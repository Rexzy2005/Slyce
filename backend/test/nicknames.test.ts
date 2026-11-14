import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/server.js';
import { nicknameMessage, nicknameProblem, NicknameService, type NicknameStore } from '../src/nickname-service.js';

const alice = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const bob = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
class MemoryStore implements NicknameStore {
  names = new Map<string, string>();
  async get(addresses: readonly string[]) { return new Map(addresses.flatMap(address => this.names.has(address) ? [[address, this.names.get(address)!] as const] : [])); }
  async set(address: string, nickname: string) {
    for (const [owner, name] of this.names) if (owner !== address && name.toLowerCase() === nickname.toLowerCase()) return false;
    this.names.set(address, nickname); return true;
  }
}
const now = Date.parse('2026-11-12T10:00:00Z');
async function signed(account: typeof alice, nickname: string, issuedAt = new Date(now).toISOString()) {
  return { address: account.address, nickname, issuedAt, signature: await account.signMessage({ message: nicknameMessage(account.address, nickname, issuedAt) }) };
}

await it('accepts sensible names and rejects bad or reserved ones', () => {
  assert.equal(nicknameProblem('Slice_Queen'), null);
  assert.match(nicknameProblem('ab')!, /3–16/);
  assert.match(nicknameProblem('no spaces')!, /3–16/);
  assert.match(nicknameProblem('a'.repeat(17))!, /3–16/);
  assert.match(nicknameProblem('Admin')!, /reserved/);
  assert.match(nicknameProblem('slyyce_team')!, /reserved/);
});

await it('sets a nickname only with the owner signature, keeps names unique and lets owners rename', async () => {
  const store = new MemoryStore();
  const service = new NicknameService(store, verifyMessage, () => now);
  assert.equal(await service.set(await signed(alice, 'SliceQueen')), 'SliceQueen');
  assert.equal((await service.lookup([alice.address])).get(alice.address.toLowerCase()), 'SliceQueen');
  await assert.rejects(service.set(await signed(bob, 'slicequeen')), { code: 'nickname_taken' });
  const forged = await signed(bob, 'Thief');
  await assert.rejects(service.set({ ...forged, address: alice.address }), { code: 'invalid_signature' });
  await assert.rejects(service.set(await signed(alice, 'Late', new Date(now - 11 * 60_000).toISOString())), { code: 'expired_signature' });
  assert.equal(await service.set(await signed(alice, 'MelonMaster')), 'MelonMaster');
  assert.equal(await service.set(await signed(bob, 'SliceQueen')), 'SliceQueen', 'a released name can be taken');
});

await it('serves nicknames over HTTP', async () => {
  const service = new NicknameService(new MemoryStore(), verifyMessage);
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { nicknameService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/nicknames`;
  const post = (body: unknown) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const issuedAt = new Date().toISOString();
    const ok = await post({ address: alice.address, nickname: 'KiwiKing', issuedAt, signature: await alice.signMessage({ message: nicknameMessage(alice.address, 'KiwiKing', issuedAt) }) });
    assert.equal(ok.status, 200);
    assert.deepEqual(((await (await fetch(`${base}?address=${alice.address}`)).json()) as { data: unknown }).data, { address: alice.address.toLowerCase(), nickname: 'KiwiKing' });
    const taken = await post({ address: bob.address, nickname: 'kiwiking', issuedAt, signature: await bob.signMessage({ message: nicknameMessage(bob.address, 'kiwiking', issuedAt) }) });
    assert.equal(taken.status, 409);
    assert.equal((await post({ address: bob.address, nickname: 'x', issuedAt, signature: '0x00' })).status, 422);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

await it('signs exactly the message the app sends (apps/web/tests/unit/nickname.test.ts pins the same text)', () => {
  assert.equal(nicknameMessage('0xABCdef0000000000000000000000000000000001', 'KiwiKing', '2026-11-12T10:00:00.000Z'),
    'Set my Slyyce nickname\nAddress: 0xabcdef0000000000000000000000000000000001\nNickname: KiwiKing\nTime: 2026-11-12T10:00:00.000Z');
});
