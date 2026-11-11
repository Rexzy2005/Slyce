import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Signed scores (ADR-0015). The backend hands out a one-time ticket before a round and, when the round ends,
 * signs the result only if it is believable for the time since the ticket was issued. The Arcade and
 * Tournament contracts accept a signed result once per ticket. Tickets are stateless: an HMAC binds the
 * ticket id, player and issue time, so no database is needed and the contracts enforce single use.
 *
 * This blocks direct contract calls, replayed results and impossible scores. A modified game client can
 * still report believable scores; full server replay is the planned follow-up.
 */
export const ticketMaxAgeMs = 30 * 60_000;
export const signatureLifetimeSeconds = 60 * 60;
/** Generous upper bound on fruit launched per second in the arena (runtime.ts pacing: ≈4.8/s at its fastest). */
export const maxFruitPerSecond = 6;
/** Covers a ticket fetched slightly after the round started (slow network). */
export const startSlackSeconds = 5;

export interface ScoreSigningConfig {
  privateKey: `0x${string}`;
  chainId: number;
  arcade: `0x${string}`;
  tournament?: `0x${string}`;
}
export interface IssuedTicket { token: string; ticket: string; issuedAt: string }
export interface RoundResult { score: number; bestCombo: number; fruits: number }
export interface SignedRound { ticket: string; deadline: number; gameSignature: `0x${string}`; tournamentSignature?: `0x${string}` }
export class ScoreRejected extends Error {
  constructor(public readonly code: 'invalid_ticket' | 'expired_ticket' | 'implausible_score' | 'extra_life_round', message: string) { super(message); }
}

/**
 * Mirrors the arena's scoring (practice-rules.ts): 10 points per fruit plus 5 per fruit in each swipe of 3+,
 * so score = 10·fruits + bonus with bonus ≤ 5·fruits, and a best combo of 3+ alone adds 5·bestCombo.
 */
export function plausibilityProblem(result: RoundResult, elapsedSeconds: number): string | null {
  const { score, bestCombo, fruits } = result;
  if (score % 5 !== 0) return 'score is not a multiple of 5';
  if (bestCombo > fruits) return 'best combo exceeds fruit sliced';
  const minimum = 10 * fruits + (bestCombo >= 3 ? 5 * bestCombo : 0);
  if (score < minimum || score > 15 * fruits) return 'score does not match fruit sliced';
  if (fruits > maxFruitPerSecond * (Math.max(0, elapsedSeconds) + startSlackSeconds)) return 'too much fruit for the time played';
  return null;
}

const gameTypes = { Game: [
  { name: 'player', type: 'address' }, { name: 'ticket', type: 'uint256' }, { name: 'score', type: 'uint32' },
  { name: 'bestCombo', type: 'uint32' }, { name: 'fruits', type: 'uint32' }, { name: 'deadline', type: 'uint64' },
] } as const;
const tournamentTypes = { TournamentScore: [
  { name: 'player', type: 'address' }, { name: 'id', type: 'uint256' }, { name: 'ticket', type: 'uint256' },
  { name: 'score', type: 'uint32' }, { name: 'deadline', type: 'uint64' },
] } as const;

export class ScoreSigningService {
  private readonly account;
  private readonly ticketKey: Buffer;
  /** `extraLifeUsed` reports rounds continued with a purchased extra life; those can't enter tournaments (ADR-0016). */
  constructor(private readonly config: ScoreSigningConfig, private readonly now: () => number = Date.now, private readonly extraLifeUsed?: (ticket: string) => Promise<boolean>) {
    this.account = privateKeyToAccount(config.privateKey);
    // Derived, so one secret configures both the signer and ticket integrity.
    this.ticketKey = createHash('sha256').update('slyyce-score-ticket:').update(config.privateKey.toLowerCase()).digest();
  }

  /** The address to register with `setScoreSigner` on both contracts. */
  get signerAddress(): `0x${string}` { return this.account.address; }

  issue(player: `0x${string}`): IssuedTicket {
    const ticket = BigInt('0x' + randomBytes(16).toString('hex')).toString();
    const issuedAt = this.now();
    const payload = Buffer.from(JSON.stringify({ t: ticket, p: player.toLowerCase(), i: issuedAt })).toString('base64url');
    return { token: `${payload}.${this.mac(payload)}`, ticket, issuedAt: new Date(issuedAt).toISOString() };
  }

  /** Checks a ticket's integrity, owner and age; returns its id and age in milliseconds. */
  verifyTicket(address: `0x${string}`, token: string): { ticket: string; ageMs: number } {
    const [payload, mac] = token.split('.');
    if (!payload || !mac || !this.validMac(payload, mac)) throw new ScoreRejected('invalid_ticket', 'This round ticket is not valid.');
    const ticket = parseTicket(payload);
    if (!ticket || ticket.p !== address.toLowerCase()) throw new ScoreRejected('invalid_ticket', 'This round ticket belongs to another player.');
    const age = this.now() - ticket.i;
    if (age < 0 || age > ticketMaxAgeMs) throw new ScoreRejected('expired_ticket', 'This round ticket has expired.');
    return { ticket: ticket.t, ageMs: age };
  }

  async finish(address: `0x${string}`, token: string, result: RoundResult, tournamentId?: bigint): Promise<SignedRound> {
    // Addresses arrive in any letter case; viem signs only checksummed ones.
    const player = checksum(address);
    const { ticket: ticketText, ageMs: age } = this.verifyTicket(player, token);
    const ticket = { t: ticketText };
    if (tournamentId !== undefined && await this.extraLifeUsed?.(ticketText)) {
      throw new ScoreRejected('extra_life_round', 'Rounds continued with an extra life can\'t be submitted to tournaments.');
    }
    const problem = plausibilityProblem(result, age / 1000);
    if (problem) throw new ScoreRejected('implausible_score', `This score could not be verified: ${problem}.`);
    const deadline = Math.floor(this.now() / 1000) + signatureLifetimeSeconds;
    const ticketId = BigInt(ticket.t);
    const gameSignature = await this.account.signTypedData({
      domain: this.domain(this.config.arcade), types: gameTypes, primaryType: 'Game',
      message: { player, ticket: ticketId, score: result.score, bestCombo: result.bestCombo, fruits: result.fruits, deadline: BigInt(deadline) },
    });
    const tournamentSignature = tournamentId !== undefined && this.config.tournament
      ? await this.account.signTypedData({
        domain: this.domain(this.config.tournament), types: tournamentTypes, primaryType: 'TournamentScore',
        message: { player, id: tournamentId, ticket: ticketId, score: result.score, deadline: BigInt(deadline) },
      })
      : undefined;
    return { ticket: ticket.t, deadline, gameSignature, ...(tournamentSignature ? { tournamentSignature } : {}) };
  }

  private domain(verifyingContract: `0x${string}`) {
    return { name: 'Slyyce', version: '1', chainId: this.config.chainId, verifyingContract: checksum(verifyingContract) } as const;
  }
  private mac(payload: string): string { return createHmac('sha256', this.ticketKey).update(payload).digest('base64url'); }
  private validMac(payload: string, mac: string): boolean {
    const expected = Buffer.from(this.mac(payload)); const given = Buffer.from(mac);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

const checksum = (address: `0x${string}`) => getAddress(address.toLowerCase());

function parseTicket(payload: string): { t: string; p: string; i: number } | null {
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof value.t === 'string' && /^\d+$/.test(value.t) && typeof value.p === 'string' && typeof value.i === 'number' ? { t: value.t, p: value.p, i: value.i } : null;
  } catch { return null; }
}
