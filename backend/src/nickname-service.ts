import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import type { SignatureVerifier } from './wallet-auth.js';

/**
 * Player nicknames (ADR-0017). A player proves they own the wallet by signing `nicknameMessage` (free; silent for
 * email accounts), so nobody can rename someone else. Names are 3–16 letters, numbers or underscores, unique
 * regardless of letter case, and a few names that could pass for staff are reserved.
 */
export const nicknamePattern = /^[A-Za-z0-9_]{3,16}$/;
const reserved = ['admin', 'administrator', 'slyyce', 'slyce', 'gooddollar', 'moderator', 'mod', 'support', 'official', 'team', 'staff', 'system', 'owner'];
export const signatureMaxAgeMs = 10 * 60_000;

export function nicknameMessage(address: string, nickname: string, issuedAt: string): string {
  return `Set my Slyyce nickname\nAddress: ${address.toLowerCase()}\nNickname: ${nickname}\nTime: ${issuedAt}`;
}
export function nicknameProblem(nickname: string): string | null {
  if (!nicknamePattern.test(nickname)) return 'Use 3–16 letters, numbers or underscores.';
  const key = nickname.toLowerCase();
  if (reserved.some(word => key === word || key.startsWith(word + '_'))) return 'That nickname is reserved. Pick another.';
  return null;
}

export class NicknameRejected extends Error {
  constructor(public readonly code: 'invalid_nickname' | 'nickname_taken' | 'invalid_signature' | 'expired_signature', message: string) { super(message); }
}
export interface NicknameStore {
  get(addresses: readonly string[]): Promise<Map<string, string>>;
  /** Saves the name; returns false if another address already holds it. */
  set(address: string, nickname: string): Promise<boolean>;
}

export class NicknameService {
  constructor(private readonly store: NicknameStore, private readonly verify: SignatureVerifier, private readonly now: () => number = Date.now) {}

  lookup(addresses: readonly string[]): Promise<Map<string, string>> {
    return this.store.get([...new Set(addresses.map(address => address.toLowerCase()))]);
  }

  async set(input: { address: `0x${string}`; nickname: string; issuedAt: string; signature: `0x${string}` }): Promise<string> {
    const nickname = input.nickname.trim();
    const problem = nicknameProblem(nickname);
    if (problem) throw new NicknameRejected('invalid_nickname', problem);
    const age = this.now() - Date.parse(input.issuedAt);
    if (!Number.isFinite(age) || age < -60_000 || age > signatureMaxAgeMs) throw new NicknameRejected('expired_signature', 'That request expired. Try again.');
    const valid = await this.verify({ address: input.address, message: nicknameMessage(input.address, nickname, input.issuedAt), signature: input.signature }).catch(() => false);
    if (!valid) throw new NicknameRejected('invalid_signature', 'The signature does not match this account.');
    if (!await this.store.set(input.address.toLowerCase(), nickname)) throw new NicknameRejected('nickname_taken', 'That nickname is taken. Pick another.');
    return nickname;
  }
}

export class PrismaNicknameStore implements NicknameStore {
  constructor(private readonly prisma: PrismaClient) {}
  async get(addresses: readonly string[]) {
    if (!addresses.length) return new Map<string, string>();
    const rows = await this.prisma.playerNickname.findMany({ where: { address: { in: [...addresses] } } });
    return new Map(rows.map(row => [row.address, row.nickname]));
  }
  async set(address: string, nickname: string) {
    try {
      await this.prisma.playerNickname.upsert({ where: { address }, create: { address, nickname, nicknameKey: nickname.toLowerCase() }, update: { nickname, nicknameKey: nickname.toLowerCase() } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }
}
