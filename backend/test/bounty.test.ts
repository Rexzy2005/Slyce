import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BountyService,
  PrismaBountyRepository,
  type BountyView,
  type BountyParticipationView,
  type BountySubmissionView,
  type BountyLeaderboardEntry,
  type BountyRepository,
} from '../src/bounty-service.js';
import type { AuthenticatedPrincipal } from '../src/security.js';
import { createApp } from '../src/server.js';

// ---------------------------------------------------------------------------
// Mock repository shared across unit tests
// ---------------------------------------------------------------------------

const MOCK_BOUNTY_ID = '00000000-0000-4000-8000-000000000070';
const MOCK_VERSION_ID = '00000000-0000-4000-8000-000000000071';
const MOCK_PLAYER_ID = '00000000-0000-4000-8000-000000000072';
const MOCK_PART_ID = '00000000-0000-4000-8000-000000000073';
const MOCK_SUB_ID = '00000000-0000-4000-8000-000000000074';

function makeBountyView(overrides: Partial<BountyView> = {}): BountyView {
  return {
    id: MOCK_BOUNTY_ID,
    slug: 'weekly-slice',
    title: 'Weekly Slice',
    description: 'Cut 50 fruits in a verified round.',
    status: 'DRAFT',
    startsAt: null,
    endsAt: null,
    publishedAt: null,
    closedAt: null,
    archivedAt: null,
    maxParticipants: null,
    rewardAsset: 'G$',
    rewardAmount: 100,
    leaderboardMode: null,
    requirements: {},
    participationsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeParticipationView(overrides: Partial<BountyParticipationView> = {}): BountyParticipationView {
  return {
    id: MOCK_PART_ID,
    bountyId: MOCK_BOUNTY_ID,
    bountySlug: 'weekly-slice',
    bountyTitle: 'Weekly Slice',
    versionId: MOCK_VERSION_ID,
    status: 'ACTIVE',
    joinedAt: new Date().toISOString(),
    completedAt: null,
    submissions: [],
    ...overrides,
  };
}

function makeSubmissionView(overrides: Partial<BountySubmissionView> = {}): BountySubmissionView {
  return {
    id: MOCK_SUB_ID,
    participationId: MOCK_PART_ID,
    status: 'PENDING',
    evidence: { scoreId: '00000000-0000-4000-8000-000000000075' },
    reviewNotes: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    ...overrides,
  };
}

class MockBountyRepository implements BountyRepository {
  private bounties: BountyView[] = [];
  private participations: BountyParticipationView[] = [];
  private submissions: BountySubmissionView[] = [];

  async create(input: Parameters<BountyRepository['create']>[0]): Promise<BountyView> {
    const view = makeBountyView({ slug: input.slug, title: input.title, description: input.description });
    this.bounties.push(view);
    return view;
  }
  async update(id: string, input: Parameters<BountyRepository['update']>[1]): Promise<BountyView> {
    const idx = this.bounties.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Not found');
    this.bounties[idx] = { ...this.bounties[idx]!, ...input };
    return this.bounties[idx]!;
  }
  async findById(id: string): Promise<BountyView | null> {
    return this.bounties.find(b => b.id === id) ?? null;
  }
  async findBySlug(slug: string): Promise<BountyView | null> {
    return this.bounties.find(b => b.slug === slug) ?? null;
  }
  async list(opts: { cursor?: string; limit: number; status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED' }): Promise<{ items: BountyView[]; nextCursor: string | null }> {
    const filtered = opts.status ? this.bounties.filter(b => b.status === opts.status) : this.bounties;
    return { items: filtered.slice(0, opts.limit), nextCursor: null };
  }
  async transition(id: string, to: BountyView['status']): Promise<BountyView> {
    const idx = this.bounties.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Not found');
    this.bounties[idx] = { ...this.bounties[idx]!, status: to };
    return this.bounties[idx]!;
  }
  async findParticipation(bountyId: string, playerId: string): Promise<BountyParticipationView | null> {
    return this.participations.find(p => p.bountyId === bountyId && p.id === MOCK_PART_ID) ?? null;
  }
  async findParticipationById(id: string): Promise<BountyParticipationView | null> {
    return this.participations.find(p => p.id === id) ?? null;
  }
  async listPlayerParticipations(playerId: string): Promise<BountyParticipationView[]> {
    return this.participations;
  }
  async join(bountyId: string, playerId: string): Promise<BountyParticipationView> {
    const b = this.bounties.find(x => x.id === bountyId);
    if (!b || b.status !== 'PUBLISHED') throw new Error('Bounty is not open for participation.');
    const view = makeParticipationView({ bountyId });
    this.participations.push(view);
    return view;
  }
  async submitEvidence(participationId: string, input: Parameters<BountyRepository['submitEvidence']>[1]): Promise<BountySubmissionView> {
    const sub = makeSubmissionView({ evidence: input.evidence });
    this.submissions.push(sub);
    const idx = this.participations.findIndex(p => p.id === participationId);
    if (idx !== -1) this.participations[idx] = { ...this.participations[idx]!, status: 'SUBMITTED' };
    return sub;
  }
  async reviewSubmission(submissionId: string, adminId: string, input: Parameters<BountyRepository['reviewSubmission']>[2]): Promise<BountySubmissionView> {
    const idx = this.submissions.findIndex(s => s.id === submissionId);
    if (idx === -1) throw new Error('Not found');
    if (this.submissions[idx]!.status !== 'PENDING') throw new Error('Already reviewed.');
    this.submissions[idx] = { ...this.submissions[idx]!, status: input.status, reviewNotes: input.reviewNotes ?? null, reviewedAt: new Date().toISOString() };
    return this.submissions[idx]!;
  }
  async leaderboard(bountyId: string, opts: { limit: number; cursor?: string }): Promise<{ items: BountyLeaderboardEntry[]; nextCursor: string | null }> {
    return { items: [], nextCursor: null };
  }
}

// ---------------------------------------------------------------------------
// Administrator principal helper
// ---------------------------------------------------------------------------

function makeAdminPrincipal(): AuthenticatedPrincipal {
  return {
    kind: 'administrator',
    subject: 'admin@example.com',
    roles: ['admin' as const],
  };
}

function makePlayerPrincipal(): AuthenticatedPrincipal {
  return {
    kind: 'player',
    subject: 'player-sub',
    playerId: MOCK_PLAYER_ID,
    roles: [],
  };
}

// ---------------------------------------------------------------------------
// Unit tests: BountyService lifecycle
// ---------------------------------------------------------------------------

await it('bounty service enforces administrator permissions for create', async () => {
  const repo = new MockBountyRepository();
  const service = new BountyService(repo);
  const player = makePlayerPrincipal();
  await assert.rejects(
    () => service.createBounty(player, {
      slug: 'test-bounty',
      title: 'Test',
      description: 'Desc',
      rewardAmount: 50,
    }),
    /administrator/i,
  );
});

await it('bounty service creates, publishes, and allows player to join', async () => {
  const repo = new MockBountyRepository();
  const service = new BountyService(repo);
  const admin = makeAdminPrincipal();

  const created = await service.createBounty(admin, {
    slug: 'weekly-slice',
    title: 'Weekly Slice',
    description: 'Cut 50 fruits.',
    rewardAmount: 100,
  });
  assert.equal(created.slug, 'weekly-slice');
  assert.equal(created.status, 'DRAFT');

  // Publish bounty
  const published = await service.publishBounty(admin, created.id);
  assert.equal(published.status, 'PUBLISHED');

  // Player can join
  const player = makePlayerPrincipal();
  const participation = await service.joinBounty(player, created.id);
  assert.equal(participation.status, 'ACTIVE');
  assert.equal(participation.bountyId, MOCK_BOUNTY_ID);
});

await it('bounty service prevents player from joining non-published bounty', async () => {
  const repo = new MockBountyRepository();
  const service = new BountyService(repo);
  const admin = makeAdminPrincipal();
  const player = makePlayerPrincipal();

  await service.createBounty(admin, {
    slug: 'draft-bounty',
    title: 'Draft',
    description: 'Not published.',
    rewardAmount: 10,
  });

  await assert.rejects(
    () => service.joinBounty(player, MOCK_BOUNTY_ID),
    /not.*open|published/i,
  );
});

await it('bounty service allows evidence submission and admin review', async () => {
  const repo = new MockBountyRepository();
  const service = new BountyService(repo);
  const admin = makeAdminPrincipal();
  const player = makePlayerPrincipal();

  await service.createBounty(admin, { slug: 'evidence-bounty', title: 'E', description: 'D', rewardAmount: 25 });
  await service.publishBounty(admin, MOCK_BOUNTY_ID);
  const participation = await service.joinBounty(player, MOCK_BOUNTY_ID);

  const evidence = { scoreId: '00000000-0000-4000-8000-000000000099', description: 'Screenshot' };
  const submission = await service.submitEvidence(player, participation.id, { evidence });
  assert.equal(submission.status, 'PENDING');

  const reviewed = await service.reviewSubmission(admin, submission.id, { status: 'APPROVED', reviewNotes: 'Looks valid.' });
  assert.equal(reviewed.status, 'APPROVED');
  assert.equal(reviewed.reviewNotes, 'Looks valid.');
});

await it('bounty service full lifecycle: draft -> published -> closed -> archived', async () => {
  const repo = new MockBountyRepository();
  const service = new BountyService(repo);
  const admin = makeAdminPrincipal();

  await service.createBounty(admin, { slug: 'lifecycle', title: 'L', description: 'D', rewardAmount: 5 });
  assert.equal((await service.getBounty(MOCK_BOUNTY_ID)).status, 'DRAFT');

  await service.publishBounty(admin, MOCK_BOUNTY_ID);
  assert.equal((await service.getBounty(MOCK_BOUNTY_ID)).status, 'PUBLISHED');

  await service.closeBounty(admin, MOCK_BOUNTY_ID);
  assert.equal((await service.getBounty(MOCK_BOUNTY_ID)).status, 'CLOSED');

  await service.archiveBounty(admin, MOCK_BOUNTY_ID);
  assert.equal((await service.getBounty(MOCK_BOUNTY_ID)).status, 'ARCHIVED');
});

// ---------------------------------------------------------------------------
// HTTP integration tests
// ---------------------------------------------------------------------------

await it('HTTP bounty routes serve admin and player operations', async () => {
  // Build mock dependencies
  const repo = new MockBountyRepository();
  const bountyService = new BountyService(repo);

  // Pre-seed a published bounty
  const admin = makeAdminPrincipal();
  const seedBounty = await bountyService.createBounty(admin, {
    slug: 'http-bounty',
    title: 'HTTP Bounty',
    description: 'For HTTP tests.',
    rewardAmount: 20,
  });
  await bountyService.publishBounty(admin, seedBounty.id);

  // Mock token verifiers
  const alwaysAdmin = { verify: async () => makeAdminPrincipal() };
  const alwaysPlayer = { verify: async () => makePlayerPrincipal() };

  const server = createApp(
    {
      port: 0, host: '127.0.0.1', environment: 'test',
      corsOrigins: [], rateLimitWindowMs: 60000, rateLimitMaxRequests: 1000,
      maxRequestBytes: 1_048_576, logLevel: 'error',
    } as Parameters<typeof createApp>[0],
    {
      verifier: alwaysAdmin,
      walletVerifier: alwaysPlayer,
      bountyService,
    },
  );

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    // Public: list published bounties
    const listRes = await fetch(`${base}/api/v1/bounties`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json() as { data: unknown[] };
    assert.equal(listBody.data.length, 1);

    // Public: get specific bounty
    const getRes = await fetch(`${base}/api/v1/bounties/${seedBounty.id}`);
    assert.equal(getRes.status, 200);

    // Public: get bounty leaderboard
    const lbRes = await fetch(`${base}/api/v1/bounties/${seedBounty.id}/leaderboard`);
    assert.equal(lbRes.status, 200);
    const lbBody = await lbRes.json() as { data: unknown[] };
    assert.equal(Array.isArray(lbBody.data), true);

    // Admin: create new bounty
    const createRes = await fetch(`${base}/api/v1/admin/bounties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ slug: 'new-bounty', title: 'New', description: 'New Bounty', rewardAmount: 75 }),
    });
    assert.equal(createRes.status, 201);

    // Admin: list all bounties
    const adminListRes = await fetch(`${base}/api/v1/admin/bounties`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(adminListRes.status, 200);

    // Player: my bounty participations (empty)
    const meRes = await fetch(`${base}/api/v1/bounties/me`, {
      headers: { Authorization: 'Bearer player-token' },
    });
    assert.equal(meRes.status, 200);

    // Player: join bounty
    const joinRes = await fetch(`${base}/api/v1/bounties/${seedBounty.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer player-token' },
      body: JSON.stringify({}),
    });
    assert.equal(joinRes.status, 201);
    const joinBody = await joinRes.json() as { data: { id: string } };
    const participationId = joinBody.data.id;
    assert.ok(participationId);

    // Player: submit evidence
    const submitRes = await fetch(`${base}/api/v1/bounty-participations/${participationId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer player-token' },
      body: JSON.stringify({ evidence: { scoreId: 'abc123', note: 'My proof' } }),
    });
    assert.equal(submitRes.status, 201);
    const submitBody = await submitRes.json() as { data: { id: string; status: string } };
    assert.equal(submitBody.data.status, 'PENDING');

    // Admin: review submission
    const reviewRes = await fetch(`${base}/api/v1/admin/bounty-submissions/${submitBody.data.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ status: 'APPROVED', reviewNotes: 'Valid proof.' }),
    });
    assert.equal(reviewRes.status, 200);
    const reviewBody = await reviewRes.json() as { data: { status: string } };
    assert.equal(reviewBody.data.status, 'APPROVED');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
