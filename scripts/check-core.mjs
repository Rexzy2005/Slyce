import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const ts = require('typescript');
async function load(relative) {
  const source = await readFile(new URL('../' + relative, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  if (/require\(/.test(output)) throw new Error('Unexpected runtime dependency in pure boundary');
  const dir = await mkdtemp(path.join(tmpdir(), 'slyyce-core-'));
  const target = path.join(dir, 'boundary.cjs');
  try { await writeFile(target, output); return require(target); }
  finally { delete require.cache[target]; await unlink(target); await rmdir(dir); }
}
const rules = await load('apps/web/src/game/practice-rules.ts');
let practice = rules.newPractice();
for (let i = 0; i < 3; i++) practice = rules.cutFruit(practice);
practice = rules.endSwipe(practice).state; assert.equal(practice.score, 45);
for (let i = 0; i < rules.startingLives; i++) practice = rules.missFruit(practice);
assert.equal(practice.over, 'lives'); assert.equal(rules.cutFruit(practice), practice);
const policy = await load('apps/web/src/pwa/cache-policy.ts');
for (const input of ['/', '/api/session', '/api/rewards', '/rpc', '/leaderboard', 'https://rpc.example/_next/static/a.js']) assert.equal(policy.safePrecachePath(input), false);
assert.equal(policy.safePrecachePath('/offline.html'), true);
const lifecycle = await load('apps/web/src/game/lifecycle.ts');
let resolveRuntime; let destroyed = 0;
const mounted = lifecycle.mountRuntime(() => new Promise(resolve => { resolveRuntime = resolve; }), error => { throw error; });
mounted.dispose(); mounted.dispose(); resolveRuntime({ resize() {}, setVisible() {}, destroy() { destroyed++; } });
await mounted.ready; assert.equal(destroyed, 1);
const transactions = await load('apps/web/src/web3/transactions.ts');
const hash = '0x' + '1'.repeat(64); const receipt = { transactionHash: hash, status: 'success' }; let submits = 0;
const ops = { prepare: async () => {}, submit: async () => { submits++; return hash; }, receipt: async () => receipt, synchronized: async () => false };
const controller = transactions.createTransactionController(() => {});
await controller.run(ops); assert.equal(controller.getState().status, 'synchronizing');
ops.synchronized = async () => true; await controller.retrySynchronization(ops);
assert.equal(controller.getState().status, 'success'); assert.equal(submits, 1);
assert.throws(() => transactions.transitionTransaction({ status: 'awaiting_wallet' }, { status: 'success', hash, receipt }));
const rejected = transactions.createTransactionController(() => {});
await rejected.run({ ...ops, submit: async () => { throw { code: 4001 }; } }); assert.equal(rejected.getState().status, 'rejected');
const reverted = transactions.createTransactionController(() => {});
await reverted.run({ ...ops, receipt: async () => ({ ...receipt, status: 'reverted' }) }); assert.equal(reverted.getState().kind, 'reverted');
const syncing = transactions.createTransactionController(() => {});
await syncing.run({ ...ops, synchronized: async () => { throw new Error('offline'); } }); assert.equal(syncing.getState().kind, 'synchronization');
await syncing.retrySynchronization(ops); assert.equal(syncing.getState().status, 'success');
console.log('Core checks passed: practice rules, cache exclusions, async teardown, transaction rejection/revert/indexer states.');
