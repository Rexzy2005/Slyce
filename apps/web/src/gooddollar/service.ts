import type { Address } from 'viem';
import type { PublicConfig } from '../config/schema';
import { apiFetch } from '../api/http';
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

/** The GoodDollar environment whose G$ token is `address`, if any (token addresses are unique per environment). */
export function goodDollarEnvForToken(address: string | undefined): NonNullable<PublicConfig['goodDollarEnv']> | undefined {
  if (!address) return undefined;
  const match = (Object.keys(goodDollarTokens) as (keyof typeof goodDollarTokens)[]).find(env => goodDollarTokens[env].toLowerCase() === address.toLowerCase());
  return match;
}

export function goodDollarAvailability(config: PublicConfig): GoodDollarAvailability {
  if (config.network !== 'celo') return { status: 'blocked', reason: 'GoodDollar verification and daily G$ run on Celo. This site is not connected to Celo.' };
  // An explicit environment must agree with the token; without one, the token identifies the environment.
  const env = config.goodDollarEnv ?? goodDollarEnvForToken(config.gdAddress);
  if (!env) return { status: 'blocked', reason: 'This site has no G$ token configured, so GoodDollar verification is switched off.' };
  if (!config.gdAddress || config.gdAddress.toLowerCase() !== goodDollarTokens[env].toLowerCase()) {
    return { status: 'blocked', reason: 'The configured G$ token does not match the GoodDollar ' + env + ' environment.' };
  }
  return { status: 'ready', env };
}

export async function recordGoodDollarVerification(backendUrl: string | undefined, address: Address): Promise<void> {
  if (!backendUrl) return;
  const response = await apiFetch(`${backendUrl}/api/v1/gooddollar/verification/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('The backend could not record the GoodDollar verification check.');
}
