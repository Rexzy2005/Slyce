import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/server.js';
import {
  evaluateRuleCondition,
  updateParticipationProgress,
  isChallengeComplete,
  ChallengeService,
  type ChallengeRepository,
  type ChallengeView,
  type ChallengeParticipationView,
  type CreateChallengeInput,
} from '../src/challenge-service.js';

test('rules engine evaluates individual rule conditions', () => {
  assert.equal(evaluateRuleCondition({ operator: 'gte', counter: 'targets_cut', threshold: 10 }, { targets_cut: 10 }), true);
  assert.equal(evaluateRuleCondition({ operator: 'gte', counter: 'targets_cut', threshold: 10 }, { targets_cut: 9 }), false);
  assert.equal(evaluateRuleCondition({ operator: 'lte', counter: 'bombs_cut', threshold: 0 }, { bombs_cut: 0 }), true);
  assert.equal(evaluateRuleCondition({ operator: 'lte', counter: 'bombs_cut', threshold: 0 }, { bombs_cut: 1 }), false);
  assert.equal(evaluateRuleCondition({ operator: 'eq', counter: 'rounds_completed', threshold: 3 }, { rounds_completed: 3 }), true);
  assert.equal(evaluateRuleCondition({ operator: 'eq', counter: 'rounds_completed', threshold: 3 }, { rounds_completed: 2 }), false);
});

test('progress updater accumulates metrics and updates high-water marks', () => {
  const initial = { targets_cut: 5, best_combo: 2, rounds_completed: 1, score: 50, clean_rounds: 1 };
  const event = { targetsCut: 10, bestCombo: 5, bombsCut: 0, score: 100, roundCompleted: true };
  const updated = updateParticipationProgress(initial, event);

  assert.equal(updated.targets_cut, 15);
  assert.equal(updated.best_combo, 5);
  assert.equal(updated.rounds_completed, 2);
  assert.equal(updated.score, 150);
  assert.equal(updated.clean_rounds, 2);

  // If next round has a lower combo and bombs cut, combo stays 5 and clean_rounds does not increment
  const event2 = { targetsCut: 3, bestCombo: 2, bombsCut: 1, score: 30, roundCompleted: true };
  const updated2 = updateParticipationProgress(updated, event2);
  assert.equal(updated2.best_combo, 5);
  assert.equal(updated2.clean_rounds, 2);
  assert.equal(updated2.rounds_completed, 3);
});

test('challenge completion validator checks all required conditions', () => {
  const rules = [
    { operator: 'gte', counter: 'targets_cut', threshold: 20 },
    { operator: 'gte', counter: 'best_combo', threshold: 3 },
  ];

  assert.equal(isChallengeComplete(rules, { targets_cut: 19, best_combo: 4 }), false);
  assert.equal(isChallengeComplete(rules, { targets_cut: 20, best_combo: 2 }), false);
  assert.equal(isChallengeComplete(rules, { targets_cut: 20, best_combo: 3 }), true);
  assert.equal(isChallengeComplete(rules, { targets_cut: 25, best_combo: 5 }), true);
});

function createMockChallengeRepo(): ChallengeRepository {
  const challenges = new Map<string, ChallengeView>();
  const participations = new Map<string, ChallengeParticipationView>();

  return {
    create: async (input: CreateChallengeInput) => {
      const id = '00000000-0000-4000-8000-000000000010';
      const versionId = '00000000-0000-4000-8000-000000000011';
      const challenge: ChallengeView = {
        id,
        slug: input.slug,
        title: input.title,
        description: input.description,
        status: 'DRAFT',
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        publishedAt: null,
        archivedAt: null,
        currentVersion: {
          id: versionId,
          version: 1,
          status: 'DRAFT',
          rulesVersion: input.rulesVersion ?? 'verified-fruit-slice-v1',
          rewardAsset: input.rewardAsset ?? 'G$',
          rewardAmount: input.rewardAmount,
          rules: input.rules.map((rule, idx) => ({
            id: `00000000-0000-4000-8000-0000000000${String(30 + idx).padStart(2, '0')}`,
            position: idx,
            eventType: rule.eventType,
            operator: rule.operator,
            counter: rule.counter,
            threshold: rule.threshold,
            configuration: rule.configuration ?? {},
          })),
          createdAt: new Date().toISOString(),
          publishedAt: null,
        },
        participationsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      challenges.set(id, challenge);
      return challenge;
    },
    update: async (id, input) => {
      const existing = challenges.get(id);
      if (!existing) throw new Error('Not found');
      const updated = {
        ...existing,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        startsAt: input.startsAt !== undefined ? input.startsAt : existing.startsAt,
        endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
      };
      challenges.set(id, updated);
      return updated;
    },
    publish: async id => {
      const existing = challenges.get(id);
      if (!existing) throw new Error('Not found');
      const updated = {
        ...existing,
        status: 'PUBLISHED' as const,
        publishedAt: new Date().toISOString(),
        currentVersion: existing.currentVersion ? {
          ...existing.currentVersion,
          status: 'PUBLISHED' as const,
          publishedAt: new Date().toISOString(),
        } : null,
      };
      challenges.set(id, updated);
      return updated;
    },
    pause: async id => {
      const existing = challenges.get(id);
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, status: 'PAUSED' as const };
      challenges.set(id, updated);
      return updated;
    },
    archive: async id => {
      const existing = challenges.get(id);
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, status: 'ARCHIVED' as const, archivedAt: new Date().toISOString() };
      challenges.set(id, updated);
      return updated;
    },
    getById: async id => challenges.get(id) ?? null,
    getBySlug: async slug => [...challenges.values()].find(c => c.slug === slug) ?? null,
    listAdmin: async () => ({ items: [...challenges.values()], nextCursor: null }),
    listPublished: async () => ({
      items: [...challenges.values()].filter(c => c.status === 'PUBLISHED'),
      nextCursor: null,
    }),
    join: async (playerId, challengeId) => {
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.status !== 'PUBLISHED') throw new Error('Challenge not available.');
      const existingKey = `${playerId}:${challengeId}`;
      const existing = participations.get(existingKey);
      if (existing) return existing;

      const participation: ChallengeParticipationView = {
        id: '00000000-0000-4000-8000-000000000020',
        challengeId: challenge.id,
        challengeSlug: challenge.slug,
        challengeTitle: challenge.title,
        versionId: challenge.currentVersion!.id,
        versionNumber: challenge.currentVersion!.version,
        status: 'ACTIVE',
        progress: { targets_cut: 0, best_combo: 0, rounds_completed: 0, score: 0, clean_rounds: 0 },
        rules: challenge.currentVersion!.rules,
        rewardAsset: challenge.currentVersion!.rewardAsset,
        rewardAmount: challenge.currentVersion!.rewardAmount,
        enrolledAt: new Date().toISOString(),
        completedAt: null,
      };
      participations.set(existingKey, participation);
      return participation;
    },
    listPlayerParticipations: async playerId => {
      return [...participations.values()].filter(p => participations.has(`${playerId}:${p.challengeId}`));
    },
    evaluateGameplayEvents: async (playerId, event) => {
      const active = [...participations.entries()].filter(([k, p]) => k.startsWith(`${playerId}:`) && p.status === 'ACTIVE');
      const results: Array<{ participationId: string; challengeTitle: string; completed: boolean; rewardCreated: boolean }> = [];
      for (const [k, p] of active) {
        const nextProgress = updateParticipationProgress(p.progress, event);
        const complete = isChallengeComplete(p.rules, nextProgress);
        if (complete) {
          const completedPart = { ...p, status: 'COMPLETED' as const, progress: nextProgress, completedAt: new Date().toISOString() };
          participations.set(k, completedPart);
          results.push({ participationId: p.id, challengeTitle: p.challengeTitle, completed: true, rewardCreated: true });
        } else {
          participations.set(k, { ...p, progress: nextProgress });
          results.push({ participationId: p.id, challengeTitle: p.challengeTitle, completed: false, rewardCreated: false });
        }
      }
      return results;
    },
  };
}

test('challenge service enforces administrator permissions and full lifecycle', async () => {
  const repo = createMockChallengeRepo();
  const service = new ChallengeService(repo);

  const admin = { subject: 'admin-1', kind: 'administrator' as const, email: 'admin@slyce.io', roles: ['admin' as const] };
  const player = { subject: 'player-1', kind: 'player' as const, playerId: '00000000-0000-4000-8000-000000000001', roles: [] as const };

  // Player cannot create challenges
  await assert.rejects(() => service.createChallenge(player as never, {
    slug: 'slice-master',
    title: 'Slice Master',
    description: 'Cut 50 fruits',
    rewardAmount: 10,
    rules: [{ eventType: 'targets_cut', operator: 'gte', counter: 'targets_cut', threshold: 50 }],
  }));

  // Admin creates draft
  const created = await service.createChallenge(admin, {
    slug: 'slice-master',
    title: 'Slice Master',
    description: 'Cut 50 fruits',
    rewardAmount: 10,
    rules: [{ eventType: 'targets_cut', operator: 'gte', counter: 'targets_cut', threshold: 50 }],
  });
  assert.equal(created.status, 'DRAFT');
  assert.equal(created.slug, 'slice-master');

  // Not visible in public list while draft
  const publicList1 = await service.listPublishedChallenges({ limit: 10 });
  assert.equal(publicList1.items.length, 0);

  // Admin publishes challenge
  const published = await service.publishChallenge(admin, created.id);
  assert.equal(published.status, 'PUBLISHED');

  // Now visible in public list
  const publicList2 = await service.listPublishedChallenges({ limit: 10 });
  assert.equal(publicList2.items.length, 1);
  assert.equal(publicList2.items[0]?.slug, 'slice-master');

  // Player joins challenge
  const joined = await service.joinChallenge(player.playerId, created.id);
  assert.equal(joined.status, 'ACTIVE');
  assert.equal(joined.challengeSlug, 'slice-master');

  // Player participates: cuts 30 fruits (not complete yet)
  const eval1 = await service.evaluateGameplay(player.playerId, {
    targetsCut: 30, bestCombo: 2, bombsCut: 0, score: 300, roundCompleted: true,
  });
  assert.equal(eval1[0]?.completed, false);

  // Player cuts 25 more fruits (total 55 >= 50 threshold -> COMPLETED)
  const eval2 = await service.evaluateGameplay(player.playerId, {
    targetsCut: 25, bestCombo: 4, bombsCut: 0, score: 250, roundCompleted: true,
  });
  assert.equal(eval2[0]?.completed, true);
  assert.equal(eval2[0]?.rewardCreated, true);

  const participations = await service.listPlayerParticipations(player.playerId);
  assert.equal(participations[0]?.status, 'COMPLETED');
});

test('HTTP challenge routes serve admin and player operations', async () => {
  const repo = createMockChallengeRepo();
  const challengeService = new ChallengeService(repo);

  const server = createApp({
    environment: 'test', port: 0, host: '127.0.0.1', corsOrigins: [],
    maxRequestBytes: 100_000, rateLimitWindowMs: 60_000, rateLimitMaxRequests: 50, adminEmails: [], goodDollarEnvironment: 'development',
  }, {
    verifier: {
      verify: async token => token === 'admin-token'
        ? { subject: 'admin-id', kind: 'administrator', email: 'admin@slyce.io', roles: ['admin' as const] }
        : null,
    },
    walletVerifier: {
      verify: async token => token === 'player-token'
        ? { subject: 'player-id', kind: 'player', playerId: '00000000-0000-4000-8000-000000000001', roles: [] as const }
        : null,
    },
    challengeService,
  }).listen(0, '127.0.0.1');

  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  // 1. Admin creates challenge draft
  const createRes = await fetch(`${baseUrl}/admin/challenges`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: 'fruit-frenzy',
      title: 'Fruit Frenzy',
      description: 'Slice 100 fruits across your rounds',
      rulesVersion: 'verified-fruit-slice-v1',
      rewardAsset: 'G$',
      rewardAmount: 25,
      rules: [
        { eventType: 'targets_cut', operator: 'gte', counter: 'targets_cut', threshold: 100 },
      ],
    }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = (await createRes.json() as { data: ChallengeView }).data;
  assert.equal(createdBody.slug, 'fruit-frenzy');
  assert.equal(createdBody.status, 'DRAFT');

  // 2. Admin lists challenges
  const listAdminRes = await fetch(`${baseUrl}/admin/challenges`, {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(listAdminRes.status, 200);
  const adminList = (await listAdminRes.json() as { data: ChallengeView[] }).data;
  assert.equal(adminList.length, 1);

  // 3. Admin publishes challenge
  const publishRes = await fetch(`${baseUrl}/admin/challenges/${createdBody.id}/publish`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(publishRes.status, 200);
  const publishedBody = (await publishRes.json() as { data: ChallengeView }).data;
  assert.equal(publishedBody.status, 'PUBLISHED');

  // 4. Public retrieves published challenges
  const publicRes = await fetch(`${baseUrl}/challenges`);
  assert.equal(publicRes.status, 200);
  const publicList = (await publicRes.json() as { data: ChallengeView[] }).data;
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0]?.slug, 'fruit-frenzy');

  // 5. Player joins challenge
  const joinRes = await fetch(`${baseUrl}/challenges/${createdBody.id}/join`, {
    method: 'POST',
    headers: { Authorization: 'Bearer player-token' },
  });
  assert.equal(joinRes.status, 201);
  const joinBody = (await joinRes.json() as { data: ChallengeParticipationView }).data;
  assert.equal(joinBody.challengeSlug, 'fruit-frenzy');
  assert.equal(joinBody.status, 'ACTIVE');

  // 6. Player views their active participations
  const meRes = await fetch(`${baseUrl}/challenges/me`, {
    headers: { Authorization: 'Bearer player-token' },
  });
  assert.equal(meRes.status, 200);
  const meList = (await meRes.json() as { data: ChallengeParticipationView[] }).data;
  assert.equal(meList.length, 1);
  assert.equal(meList[0]?.challengeSlug, 'fruit-frenzy');

  server.close();
  await once(server, 'close');
});
