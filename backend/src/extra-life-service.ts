import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { ScoreRejected, type ScoreSigningService } from './score-signing-service.js';

/**
 * Extra lives (ADR-0016). Players buy packs of `livesPerPack` as SlyceShop item `extraLifeItemId` (repeat
 * purchases allowed); the shop's `purchased` count is the source of truth for lives owned. Each life used is
 * recorded here against the round's ticket, so clearing a phone can't restore lives and a round that used one
 * can be kept out of tournaments.
 */
export const extraLifeItemId = 401n;
export const livesPerPack = 3;

export interface ExtraLifeStore {
  usedCount(address: string): Promise<number>;
  /** Records use number `useNumber`; returns false if that number was already taken (a concurrent use). */
  record(address: string, useNumber: number, ticket: string): Promise<boolean>;
  ticketUsed(ticket: string): Promise<boolean>;
}
export type PacksOwned = (address: `0x${string}`) => Promise<bigint>;
export interface ExtraLifeBalance { owned: number; used: number; available: number }
export class NoExtraLives extends Error {}

export class ExtraLifeService {
  constructor(private readonly store: ExtraLifeStore, private readonly packsOwned: PacksOwned, private readonly tickets: ScoreSigningService) {}

  async balance(address: `0x${string}`): Promise<ExtraLifeBalance> {
    const key = address.toLowerCase();
    const [packs, used] = await Promise.all([this.packsOwned(address), this.store.usedCount(key)]);
    const owned = Number(packs) * livesPerPack;
    return { owned, used, available: Math.max(0, owned - used) };
  }

  /** Spends one life on the round identified by `token`. Throws ScoreRejected for a bad ticket, NoExtraLives when none are left. */
  async use(address: `0x${string}`, token: string): Promise<ExtraLifeBalance> {
    const { ticket } = this.tickets.verifyTicket(address, token);
    const key = address.toLowerCase();
    for (let attempt = 0; attempt < 3; attempt++) {
      const balance = await this.balance(address);
      if (balance.available <= 0) throw new NoExtraLives('No extra lives left.');
      if (await this.store.record(key, balance.used + 1, ticket)) return { ...balance, used: balance.used + 1, available: balance.available - 1 };
    }
    throw new NoExtraLives('Your extra lives changed. Try again.');
  }

  ticketUsed(ticket: string): Promise<boolean> { return this.store.ticketUsed(ticket); }
}

export class PrismaExtraLifeStore implements ExtraLifeStore {
  constructor(private readonly prisma: PrismaClient) {}
  usedCount(address: string) { return this.prisma.extraLifeUse.count({ where: { address } }); }
  async record(address: string, useNumber: number, ticket: string) {
    try { await this.prisma.extraLifeUse.create({ data: { address, useNumber, ticket } }); return true; }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false; throw error; }
  }
  async ticketUsed(ticket: string) { return (await this.prisma.extraLifeUse.count({ where: { ticket } })) > 0; }
}

const purchasedAbi = [{ type: 'function', name: 'purchased', stateMutability: 'view', inputs: [{ name: 'buyer', type: 'address' }, { name: 'itemId', type: 'uint256' }], outputs: [{ type: 'uint256' }] }] as const;
export function createPacksOwnedReader(rpcUrl: string, shop: `0x${string}`): PacksOwned {
  const client = createPublicClient({ chain: celo, transport: http(rpcUrl) });
  return address => client.readContract({ address: shop, abi: purchasedAbi, functionName: 'purchased', args: [address, extraLifeItemId] });
}

export { ScoreRejected };
