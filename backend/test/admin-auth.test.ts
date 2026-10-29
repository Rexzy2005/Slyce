import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminAuthService, hashAdminPassword, normalizeAdminEmail, verifyAdminPassword } from '../src/admin-auth.js';

type Admin = { id: string; externalSubject: string; email: string | null; passwordHash: string | null; active: boolean; role: 'OPERATOR' | 'REVIEWER' | 'ADMIN' | 'SUPER_ADMIN' };
type Session = { id: string; adminId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date };

function databaseFor(admin: Admin | null) {
  const sessions: Session[] = [];
  const adminAccount = { findFirst: async ({ where }: { where: { email: string } }) => admin?.email === where.email ? admin : null };
  const adminSession = {
    updateMany: async ({ where, data }: { where: { adminId?: string; tokenHash?: string; revokedAt: null }; data: { revokedAt: Date } }) => {
      let count = 0;
      for (const session of sessions) if (!session.revokedAt && (!where.adminId || session.adminId === where.adminId) && (!where.tokenHash || session.tokenHash === where.tokenHash)) { session.revokedAt = data.revokedAt; count += 1; }
      return { count };
    },
    create: async ({ data }: { data: Omit<Session, 'id' | 'revokedAt' | 'lastSeenAt'> }) => { const value = { ...data, id: String(sessions.length + 1), revokedAt: null, lastSeenAt: new Date(0) }; sessions.push(value); return value; },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      const session = sessions.find(value => value.tokenHash === where.tokenHash);
      return session && admin ? { id: session.id, expiresAt: session.expiresAt, revokedAt: session.revokedAt, admin } : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: { lastSeenAt: Date } }) => { const session = sessions.find(value => value.id === where.id); if (session) session.lastSeenAt = data.lastSeenAt; return session; },
  };
  return { database: { adminAccount, adminSession, $transaction: async (operation: (value: { adminSession: typeof adminSession }) => Promise<unknown>) => operation({ adminSession }) } as never, sessions };
}

test('password hashes are salted, verifiable, and never contain plaintext', async () => {
  const password = 'correct horse battery staple';
  const first = await hashAdminPassword(password);
  const second = await hashAdminPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyAdminPassword(password, first), true);
  assert.equal(await verifyAdminPassword('incorrect password', first), false);
});

test('admin login normalizes email, checks allowlist, account state, role, and password', async () => {
  const passwordHash = await hashAdminPassword('correct horse battery staple');
  const admin: Admin = { id: 'admin-1', externalSubject: 'local-admin:admin@example.com', email: 'admin@example.com', passwordHash, active: true, role: 'ADMIN' };
  const { database } = databaseFor(admin);
  const service = new AdminAuthService(database, ['admin@example.com'], () => new Date('2026-10-29T00:00:00.000Z'));
  assert.equal(normalizeAdminEmail(' ADMIN@Example.com '), 'admin@example.com');
  assert.ok(await service.login(' ADMIN@Example.com ', 'correct horse battery staple'));
  assert.equal(await service.login('admin@example.com', 'incorrect password'), null);
  assert.equal(await new AdminAuthService(database, []).login('admin@example.com', 'correct horse battery staple'), null);
  admin.active = false;
  assert.equal(await service.login('admin@example.com', 'correct horse battery staple'), null);
  admin.active = true; admin.role = 'REVIEWER';
  assert.equal(await service.login('admin@example.com', 'correct horse battery staple'), null);
});

test('admin sessions expire, revoke on logout, and recheck the current allowlist', async () => {
  const passwordHash = await hashAdminPassword('correct horse battery staple');
  const admin: Admin = { id: 'admin-1', externalSubject: 'local-admin:admin@example.com', email: 'admin@example.com', passwordHash, active: true, role: 'ADMIN' };
  let now = new Date('2026-10-29T00:00:00.000Z');
  const { database } = databaseFor(admin);
  const service = new AdminAuthService(database, ['admin@example.com'], () => now);
  const login = await service.login('admin@example.com', 'correct horse battery staple');
  assert.ok(login);
  assert.equal((await service.verify(login.token))?.kind, 'administrator');
  await service.logout(login.token);
  assert.equal(await service.verify(login.token), null);

  const second = await service.login('admin@example.com', 'correct horse battery staple');
  assert.ok(second);
  now = new Date('2026-11-29T00:00:01.000Z');
  assert.equal(await service.verify(second.token), null);
  assert.equal(await new AdminAuthService(database, []).verify(second.token), null);
});
