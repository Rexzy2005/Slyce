import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { verifyMessage } from 'viem';
import type { PrismaClient } from './generated/prisma/client.js';
import type { AuthenticatedPrincipal, TokenVerifier } from './security.js';

const challengeLifetimeMs = 5 * 60_000;
const sessionLifetimeMs = 24 * 60 * 60_000;

export interface WalletChallenge {
  id: string;
  address: `0x${string}`;
  chainId: number;
  nonce: string;
  origin: string;
  expiresAt: Date;
}

export interface WalletChallengeStore {
  create(challenge: WalletChallenge): Promise<void>;
  consume(nonce: string, now: Date): Promise<WalletChallenge | null>;
}

export class PrismaWalletChallengeStore implements WalletChallengeStore {
  constructor(private readonly database: PrismaClient) {}

  async create(challenge: WalletChallenge): Promise<void> {
    await this.database.walletAuthChallenge.create({ data: challenge });
  }

  async consume(nonce: string, now: Date): Promise<WalletChallenge | null> {
    return this.database.$transaction(async transaction => {
      const challenge = await transaction.walletAuthChallenge.findUnique({ where: { nonce } });
      if (!challenge || challenge.consumedAt || challenge.expiresAt <= now) return null;
      await transaction.walletAuthChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
      return { id: challenge.id, address: challenge.address as `0x${string}`, chainId: challenge.chainId, nonce: challenge.nonce, origin: challenge.origin, expiresAt: challenge.expiresAt };
    });
  }
}

export class PrismaWalletPlayerStore {
  constructor(private readonly database: PrismaClient) {}

  async findOrCreate(address: `0x${string}`, chainId: number): Promise<string> {
    const normalized = address.toLowerCase();
    const existing = await this.database.wallet.findUnique({ where: { chainId_address: { chainId, address: normalized } }, select: { playerId: true } });
    if (existing) return existing.playerId;
    const playerId = randomUUID();
    await this.database.$transaction(async transaction => {
      await transaction.player.create({ data: { id: playerId } });
      await transaction.wallet.create({ data: { playerId, address: normalized, chainId } });
    });
    return playerId;
  }
}

export function createWalletChallenge(address: `0x${string}`, chainId: number, origin: string, now = new Date()): WalletChallenge {
  return { id: randomUUID(), address, chainId, origin, nonce: randomBytes(32).toString('base64url'), expiresAt: new Date(now.getTime() + challengeLifetimeMs) };
}

export function walletAuthMessage(challenge: WalletChallenge): string {
  const issuedAt = new Date(challenge.expiresAt.getTime() - challengeLifetimeMs).toISOString();
  return `Slyce wants you to sign in with your Celo account:\n${challenge.address}\n\nSign in to Slyce.\n\nURI: ${challenge.origin}\nChain ID: ${challenge.chainId}\nNonce: ${challenge.nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${challenge.expiresAt.toISOString()}`;
}

export function createWalletSessionToken(principal: AuthenticatedPrincipal, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: principal.subject, playerId: principal.playerId, address: principal.subject, exp: now + sessionLifetimeMs }), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export class WalletSessionTokenVerifier implements TokenVerifier {
  constructor(private readonly secret: string, private readonly playerLookup: (address: string) => Promise<string | null>, private readonly now = Date.now) {}

  async verify(token: string): Promise<AuthenticatedPrincipal | null> {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', this.secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    let data: { sub?: string; address?: string; playerId?: string; exp?: number };
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as typeof data; } catch { return null; }
    if (!data.sub || !data.address || !data.playerId || !data.exp || data.exp <= this.now()) return null;
    const playerId = await this.playerLookup(data.address);
    if (playerId !== data.playerId) return null;
    return { subject: data.sub, kind: 'player', playerId: data.playerId, roles: [] };
  }
}

export async function verifyWalletChallenge(
  store: WalletChallengeStore,
  input: { address: `0x${string}`; nonce: string; signature: `0x${string}`; origin: string },
  secret: string,
  playerStore: { findOrCreate(address: `0x${string}`, chainId: number): Promise<string> },
  now = new Date(),
): Promise<{ token: string; playerId: string }> {
  const challenge = await store.consume(input.nonce, now);
  if (!challenge || challenge.origin !== input.origin || challenge.address.toLowerCase() !== input.address.toLowerCase()) throw new Error('The wallet challenge is invalid or expired.');
  if (!await verifyMessage({ address: challenge.address, message: walletAuthMessage(challenge), signature: input.signature })) throw new Error('The wallet signature is invalid.');
  const playerId = await playerStore.findOrCreate(challenge.address, challenge.chainId);
  return { token: createWalletSessionToken({ subject: challenge.address.toLowerCase(), kind: 'player', playerId, roles: [] }, secret, now.getTime()), playerId };
}
