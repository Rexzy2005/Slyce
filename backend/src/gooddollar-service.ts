import { createPublicClient, http, type Address } from 'viem';
import { celo } from 'viem/chains';
import type { BackendConfig } from './config.js';
import { PrismaClient } from './generated/prisma/client.js';

const identityAbi = [
  { type: 'function', name: 'getWhitelistedRoot', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'lastAuthenticated', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'authenticationPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const zeroAddress = '0x0000000000000000000000000000000000000000';
const identityAddresses: Record<BackendConfig['goodDollarEnvironment'], Address> = {
  production: '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42',
  staging: '0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D',
  development: '0xF25fA0D4896271228193E782831F6f3CFCcF169C',
};

export type GoodDollarCheck = {
  address: Address;
  state: 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
  rootIdentityReference: Address | null;
  lastAuthenticatedAt: Date | null;
  unavailableReason?: string;
};

export interface GoodDollarPublicClient {
  readContract(args: unknown): Promise<unknown>;
}

export interface GoodDollarRecordStore {
  upsert(record: GoodDollarCheck & { environment: string }): Promise<void>;
  countVerified(environment: string): Promise<number>;
}

export function createGoodDollarPublicClient(config: BackendConfig): GoodDollarPublicClient | null {
  if (!config.goodDollarRpcUrl) return null;
  return createPublicClient({ chain: celo, transport: http(config.goodDollarRpcUrl) }) as GoodDollarPublicClient;
}

export class PrismaGoodDollarRecordStore implements GoodDollarRecordStore {
  constructor(private readonly database: Pick<PrismaClient, 'goodDollarVerificationRecord'>) {}

  async upsert(record: GoodDollarCheck & { environment: string }): Promise<void> {
    await this.database.goodDollarVerificationRecord.upsert({
      where: { address_environment: { address: record.address, environment: record.environment } },
      create: {
        address: record.address,
        environment: record.environment,
        state: record.state,
        ...(record.rootIdentityReference ? { rootIdentityReference: record.rootIdentityReference } : {}),
        ...(record.lastAuthenticatedAt ? { lastAuthenticatedAt: record.lastAuthenticatedAt } : {}),
        ...(record.state === 'VERIFIED' ? { lastSuccessfulCheckAt: new Date() } : {}),
        lastAttemptedCheckAt: new Date(),
        ...(record.unavailableReason ? { unavailableReason: record.unavailableReason } : {}),
      },
      update: {
        state: record.state,
        rootIdentityReference: record.rootIdentityReference,
        lastAuthenticatedAt: record.lastAuthenticatedAt,
        ...(record.state === 'VERIFIED' ? { lastSuccessfulCheckAt: new Date() } : {}),
        lastAttemptedCheckAt: new Date(),
        unavailableReason: record.unavailableReason ?? null,
      },
    });
  }

  async countVerified(environment: string): Promise<number> {
    const records = await this.database.goodDollarVerificationRecord.findMany({
      where: { environment, state: 'VERIFIED', rootIdentityReference: { not: null } },
      select: { rootIdentityReference: true },
    });
    return new Set(records.map(record => record.rootIdentityReference?.toLowerCase()).filter((root): root is string => Boolean(root))).size;
  }
}

export async function checkGoodDollarAddress(
  client: GoodDollarPublicClient,
  identityAddress: Address,
  address: Address,
  now = new Date(),
): Promise<GoodDollarCheck> {
  try {
    const [rootResult, lastAuthenticatedResult, periodDaysResult] = await Promise.all([
      client.readContract({ address: identityAddress, abi: identityAbi, functionName: 'getWhitelistedRoot', args: [address] }),
      client.readContract({ address: identityAddress, abi: identityAbi, functionName: 'lastAuthenticated', args: [address] }),
      client.readContract({ address: identityAddress, abi: identityAbi, functionName: 'authenticationPeriod' }),
    ]);
    const root = rootResult as Address;
    const lastAuthenticated = lastAuthenticatedResult as bigint;
    const periodDays = periodDaysResult as bigint;
    const authenticatedAt = Number(lastAuthenticated);
    const expiresAt = authenticatedAt + Number(periodDays) * 86_400;
    const verified = root.toLowerCase() !== zeroAddress && authenticatedAt > 0 && now.getTime() / 1000 <= expiresAt;
    return {
      address,
      state: verified ? 'VERIFIED' : 'UNVERIFIED',
      rootIdentityReference: root.toLowerCase() === zeroAddress ? null : root,
      lastAuthenticatedAt: authenticatedAt > 0 ? new Date(authenticatedAt * 1000) : null,
    };
  } catch (error) {
    return {
      address,
      state: 'UNAVAILABLE',
      rootIdentityReference: null,
      lastAuthenticatedAt: null,
      unavailableReason: error instanceof Error ? error.message.slice(0, 500) : 'GoodDollar Identity could not be read.',
    };
  }
}

export function goodDollarIdentityAddress(config: BackendConfig): Address | null {
  if (config.goodDollarIdentityAddress && config.goodDollarIdentityAddress.toLowerCase() !== zeroAddress) return config.goodDollarIdentityAddress as Address;
  return identityAddresses[config.goodDollarEnvironment];
}
