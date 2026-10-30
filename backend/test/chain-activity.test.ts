import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { ChainActivityIndex, ChainActivityService, type ActivityLog, type ActivityLogSource } from '../src/chain-activity-service.js';
import type { AuthenticatedPrincipal } from '../src/security.js';

const alice = '0x00000000000000000000000000000000000000A1';
const bob = '0x00000000000000000000000000000000000000B2';
const G = 10n ** 18n;

function log(eventName: string, args: Record<string, unknown>, block: bigint, index: number): ActivityLog {
  return { eventName, args, transactionHash: `0x${block.toString(16).padStart(64, '0')}`, blockNumber: block, logIndex: index, blockTimestamp: 1_800_000_000n + block };
}

class FakeSource implements ActivityLogSource {
  head = 12_010n;
  calls: [bigint, bigint][] = [];
  constructor(private readonly all: ActivityLog[]) {}
  async latestBlock() { return this.head; }
  async logs(from: bigint, to: bigint) {
    assert.ok(to - from < 5_000n, 'range must respect the provider limit');
    this.calls.push([from, to]);
    return this.all.filter(entry => entry.blockNumber! >= from && entry.blockNumber! <= to);
  }
}

const logs = [
  log('GameRecorded', { player: alice, gameId: 1n, score: 600, bestCombo: 3, fruits: 40, xpGained: 60n }, 1_000n, 0),
  log('MilestoneRewarded', { player: alice, gameId: 1n, milestoneScore: 500, reward: 5n * G }, 1_000n, 1),
  log('Purchased', { buyer: bob, itemId: 101n, quantity: 1n, paid: 100n * G }, 7_000n, 0),
  log('Entered', { id: 1n, player: alice, fee: 10n * G }, 11_000n, 2),
  log('GameRecorded', { player: alice, gameId: 2n, score: 300, bestCombo: 0, fruits: 30, xpGained: 30n }, 11_500n, 0),
  log('ItemSet', { itemId: 1n }, 11_600n, 0),
];

const admin: AuthenticatedPrincipal = { kind: 'administrator', subject: 'admin', roles: ['admin'] };
const player: AuthenticatedPrincipal = { kind: 'player', subject: 'p', playerId: '00000000-0000-4000-8000-000000000098', roles: [] };

await it('indexes contract logs into transactions and per-user totals', async () => {
  const source = new FakeSource(logs);
  const index = new ChainActivityIndex(source, 900n);
  await index.sync();
  const summary = index.summary();
  assert.equal(summary.users, 2);
  assert.equal(summary.transactions, 5, 'unknown events are ignored');
  assert.equal(summary.games, 2);
  assert.equal(summary.indexedToBlock, 12_008);
  assert.equal(summary.catchingUp, false);

  const users = index.listUsers({ limit: 10 }).items;
  assert.equal(users[0]!.address, alice.toLowerCase(), 'most recently active first');
  assert.deepEqual({ games: users[0]!.games, best: users[0]!.bestScore, xp: users[0]!.xp, earned: users[0]!.earned, spent: users[0]!.spent, tx: users[0]!.transactions },
    { games: 2, best: 600, xp: 90, earned: (5n * G).toString(), spent: (10n * G).toString(), tx: 4 });
  assert.equal(users[0]!.firstSeen, new Date((1_800_000_000 + 1_000) * 1000).toISOString());

  const purchases = index.listTransactions({ limit: 10, kind: 'purchase' }).items;
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0]!.direction, 'out');
  assert.equal(index.listTransactions({ limit: 10, account: bob }).items.length, 1);
  assert.equal(index.listUsers({ limit: 10, search: 'b2' }).items.length, 1);
});

await it('scans incrementally, pages results and bounds each sync', async () => {
  let now = 0;
  const source = new FakeSource(logs);
  const index = new ChainActivityIndex(source, 900n, { maxChunksPerSync: 2, minSyncIntervalMs: 1_000, now: () => now });
  await index.sync();
  assert.equal(source.calls.length, 2);
  assert.equal(index.summary().catchingUp, true);
  await index.sync();
  assert.equal(index.summary().catchingUp, false, 'catching up ignores the throttle');
  const before = source.calls.length;
  source.head = 20_000n;
  await index.sync();
  assert.equal(source.calls.length, before, 'throttled when caught up');
  now = 2_000;
  await index.sync();
  assert.ok(source.calls.length > before);
  assert.ok(source.calls.every(([from], i) => i === 0 || from === source.calls[i - 1]![1] + 1n), 'ranges are contiguous');

  const first = index.listTransactions({ limit: 2 });
  assert.equal(first.items.length, 2);
  assert.equal(first.nextCursor, '2');
  const second = index.listTransactions({ limit: 2, cursor: first.nextCursor! });
  assert.notEqual(second.items[0]!.id, first.items[0]!.id);
});

await it('restricts on-chain activity to administrators and serves it over HTTP', async () => {
  const service = new ChainActivityService(new ChainActivityIndex(new FakeSource(logs), 900n));
  await assert.rejects(() => service.users(player, { limit: 5 }), /administrator/i);
  const server = createApp({ port: 0, host: '127.0.0.1', environment: 'test', corsOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 100, maxRequestBytes: 1_048_576, adminEmails: [], goodDollarEnvironment: 'development' }, { verifier: { verify: async () => admin }, chainActivityService: service });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/chain`;
  const auth = { headers: { Authorization: 'Bearer admin' } };
  try {
    const users = await fetch(`${base}/users?limit=1`, auth);
    assert.equal(users.status, 200);
    const body = await users.json() as { data: unknown[]; summary: { users: number }; pagination: { nextCursor: string | null } };
    assert.equal(body.data.length, 1);
    assert.equal(body.summary.users, 2);
    assert.equal(body.pagination.nextCursor, '1');
    const transactions = await fetch(`${base}/transactions?kind=game`, auth);
    assert.equal(((await transactions.json()) as { data: unknown[] }).data.length, 2);
    assert.equal((await fetch(`${base}/transactions?kind=bogus`, auth)).status, 400);
    assert.equal((await fetch(`${base}/users?cursor=-1`, auth)).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

await it('reads chain activity configuration only when addresses are set', () => {
  assert.equal(loadConfig({}).chainActivity, undefined);
  const config = loadConfig({ GOODDOLLAR_RPC_URL: 'https://forno.celo.org', SLYYCE_ARCADE_ADDRESS: alice, SLYYCE_CONTRACTS_START_BLOCK: '81395214' }).chainActivity;
  assert.equal(config?.startBlock, 81_395_214n);
  assert.deepEqual(config?.contracts, [alice]);
  assert.throws(() => loadConfig({ GOODDOLLAR_RPC_URL: 'https://forno.celo.org', SLYYCE_ARCADE_ADDRESS: alice }), /START_BLOCK/);
  assert.throws(() => loadConfig({ SLYYCE_ARCADE_ADDRESS: 'nope', SLYYCE_CONTRACTS_START_BLOCK: '1' }), /ARCADE/);
});
