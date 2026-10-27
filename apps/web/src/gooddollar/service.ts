import type { Address } from 'viem';
import type { PublicConfig } from '../config/schema';
/**
 * G$ token addresses per GoodDollar environment on Celo, from @goodsdks/citizen-sdk 1.2.7 chainConfigs
 * (docs/research/gooddollar.md). The configured token must match the selected environment.
 */
export const goodDollarTokens = {
  production: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
  staging: '0x61FA0fB802fd8345C06da558240E0651886fec69',
  development: '0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475',
} as const satisfies Record<NonNullable<PublicConfig['goodDollarEnv']>, Address>;
export type GoodDollarAvailability =
  | { status: 'ready'; env: NonNullable<PublicConfig['goodDollarEnv']> }
  | { status: 'blocked'; reason: string };

export type GoodDollarCallback =
  | { status: 'none' }
  | { status: 'verified' }
  | { status: 'failed'; reason: string | null };

export function readGoodDollarCallback(search: string): GoodDollarCallback {
  const params = new URLSearchParams(search);
  const isVerified = params.get('isVerified');
  if (isVerified === null) return { status: 'none' };
  if (isVerified.toLowerCase() === 'true') return { status: 'verified' };
  return { status: 'failed', reason: params.get('reason') };
}

export function goodDollarAvailability(config: PublicConfig): GoodDollarAvailability {
  if (config.network !== 'celo' || !config.goodDollarEnv) return { status: 'blocked', reason: 'GoodDollar claiming is not configured for this environment.' };
  if (!config.gdAddress || config.gdAddress.toLowerCase() !== goodDollarTokens[config.goodDollarEnv].toLowerCase()) {
    return { status: 'blocked', reason: 'The configured G$ token does not match the GoodDollar ' + config.goodDollarEnv + ' environment.' };
  }
  return { status: 'ready', env: config.goodDollarEnv };
}

export async function recordGoodDollarVerification(backendUrl: string | undefined, address: Address): Promise<void> {
  if (!backendUrl) return;
  const response = await fetch(`${backendUrl}/api/v1/gooddollar/verification/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('The backend could not record the GoodDollar verification check.');
}
