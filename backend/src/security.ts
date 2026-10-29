import type { IncomingMessage, ServerResponse } from 'node:http';
import { adminSessionToken } from './admin-auth.js';

export type AdminRole = 'reviewer' | 'admin' | 'super_admin';

export interface AuthenticatedPrincipal {
  subject: string;
  kind: 'player' | 'administrator';
  email?: string;
  playerId?: string;
  roles: readonly AdminRole[];
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal | null>;
}

export class SecurityError extends Error {
  constructor(
    readonly code: 'unauthenticated' | 'forbidden' | 'invalid_token',
    message: string,
    readonly statusCode: 401 | 403,
  ) {
    super(message);
  }
}

export function bearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}

export async function authenticate(request: IncomingMessage, verifier: TokenVerifier): Promise<AuthenticatedPrincipal> {
  const token = bearerToken(request) ?? adminSessionToken(request);
  if (!token) throw new SecurityError('unauthenticated', 'Authentication is required.', 401);
  try {
    const principal = await verifier.verify(token);
    if (!principal) throw new SecurityError('invalid_token', 'The authentication credential is invalid.', 401);
    return principal;
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    throw new SecurityError('invalid_token', 'The authentication credential is invalid.', 401);
  }
}

export class CompositeTokenVerifier implements TokenVerifier {
  constructor(private readonly verifiers: readonly TokenVerifier[]) {}

  async verify(token: string): Promise<AuthenticatedPrincipal | null> {
    for (const verifier of this.verifiers) {
      const principal = await verifier.verify(token);
      if (principal) return principal;
    }
    return null;
  }
}

export function requireAdministrator(principal: AuthenticatedPrincipal): void {
  if (principal.kind !== 'administrator') throw new SecurityError('forbidden', 'Administrator access is required.', 403);
}

export function requireAllowedAdministratorEmail(principal: AuthenticatedPrincipal, allowedEmails: readonly string[]): void {
  requireAdministrator(principal);
  if (!principal.email || !allowedEmails.includes(principal.email.toLowerCase())) {
    throw new SecurityError('forbidden', 'This administrator account is not permitted.', 403);
  }
}

export function requireAdminRole(principal: AuthenticatedPrincipal, role: AdminRole): void {
  requireAdministrator(principal);
  const rank: Record<AdminRole, number> = { reviewer: 1, admin: 2, super_admin: 3 };
  if (!principal.roles.some(candidate => rank[candidate] >= rank[role])) throw new SecurityError('forbidden', 'This administrator role is not permitted to perform the action.', 403);
}

export function requirePlayerOwnership(principal: AuthenticatedPrincipal, playerId: string): void {
  if (principal.kind !== 'player' || principal.playerId !== playerId) throw new SecurityError('forbidden', 'This resource does not belong to the authenticated player.', 403);
}

export function applyCors(response: ServerResponse, origin: string | undefined, allowedOrigins: readonly string[]): void {
  if (!origin || (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin))) return;
  // Credentialed CORS cannot return a literal wildcard. Reflecting the request
  // origin preserves browser compatibility when an explicit wildcard is enabled.
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Slyce-CSRF');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

export function requestContentLength(request: IncomingMessage): number {
  const value = request.headers['content-length'];
  if (!value || !/^\d+$/.test(value)) return 0;
  return Number(value);
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly windowMs: number, private readonly maxRequests: number, private readonly now = () => Date.now()) {}

  allow(key: string): boolean {
    const timestamp = this.now();
    const current = this.windows.get(key);
    if (!current || timestamp - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: timestamp, count: 1 });
      return true;
    }
    if (current.count >= this.maxRequests) return false;
    current.count += 1;
    return true;
  }
}
