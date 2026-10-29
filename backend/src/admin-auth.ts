import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal, TokenVerifier } from './security.js';

export const ADMIN_SESSION_COOKIE = 'slyce_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error('Administrator password must contain between 12 and 1024 characters');
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$v1$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyAdminPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
  const [n, r, p] = parts.slice(2, 5).map(Number);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  try {
    const salt = Buffer.from(parts[5] ?? '', 'base64');
    const expected = Buffer.from(parts[6] ?? '', 'base64');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function roleForPrincipal(role: 'OPERATOR' | 'REVIEWER' | 'ADMIN' | 'SUPER_ADMIN'): AuthenticatedPrincipal['roles'] {
  if (role === 'SUPER_ADMIN') return ['super_admin'];
  if (role === 'ADMIN') return ['admin'];
  return ['reviewer'];
}

export class AdminAuthService implements TokenVerifier {
  constructor(
    private readonly database: PrismaClient,
    private readonly allowedEmails: readonly string[],
    private readonly now = () => new Date(),
  ) {}

  async login(emailInput: string, password: string): Promise<{ token: string; principal: AuthenticatedPrincipal } | null> {
    const email = normalizeAdminEmail(emailInput);
    if (!this.allowedEmails.includes(email)) return null;
    const admin = await this.database.adminAccount.findFirst({ where: { email }, select: { id: true, externalSubject: true, email: true, passwordHash: true, active: true, role: true } });
    if (!admin?.passwordHash || !admin.active || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) return null;
    if (!(await verifyAdminPassword(password, admin.passwordHash))) return null;

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
    await this.database.$transaction(async transaction => {
      await transaction.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: this.now() } });
      await transaction.adminSession.create({ data: { adminId: admin.id, tokenHash: tokenHash(token), expiresAt } });
    });
    return { token, principal: { subject: admin.externalSubject, kind: 'administrator', email, roles: roleForPrincipal(admin.role) } };
  }

  async verify(token: string): Promise<AuthenticatedPrincipal | null> {
    const now = this.now();
    const session = await this.database.adminSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      select: { id: true, expiresAt: true, revokedAt: true, admin: { select: { externalSubject: true, email: true, active: true, role: true } } },
    });
    const email = session?.admin.email ? normalizeAdminEmail(session.admin.email) : '';
    if (!session || session.revokedAt || session.expiresAt <= now || !session.admin.active || !['ADMIN', 'SUPER_ADMIN'].includes(session.admin.role) || !this.allowedEmails.includes(email)) return null;
    await this.database.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    return { subject: session.admin.externalSubject, kind: 'administrator', email, roles: roleForPrincipal(session.admin.role) };
  }

  async logout(token: string): Promise<void> {
    await this.database.adminSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: this.now() } });
  }
}

export function readCookie(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function adminSessionToken(request: IncomingMessage): string | null {
  return readCookie(request, ADMIN_SESSION_COOKIE);
}

export function setAdminSessionCookie(response: ServerResponse, token: string, production: boolean): void {
  response.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}; SameSite=${production ? 'None' : 'Lax'}${production ? '; Secure' : ''}`);
}

export function clearAdminSessionCookie(response: ServerResponse, production: boolean): void {
  response.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=${production ? 'None' : 'Lax'}${production ? '; Secure' : ''}`);
}
