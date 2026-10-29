import { describe, expect, it } from 'vitest';
import { chainConfigs, SupportedChains } from '@goodsdks/citizen-sdk';
import { goodDollarAvailability, goodDollarTokens, readGoodDollarCallback } from '../../src/gooddollar/service';
describe('GoodDollar configuration', () => {
  it('pins the same G$ tokens the installed SDK uses on Celo', () => {
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(goodDollarTokens[env].toLowerCase()).toBe(chainConfigs[SupportedChains.CELO].contracts[env]?.g$Contract.toLowerCase());
    }
  });
  it('blocks mismatched or non-Celo configuration', () => {
    expect(goodDollarAvailability({ network: 'celo', goodDollarEnv: 'production', gdAddress: goodDollarTokens.production }).status).toBe('ready');
    expect(goodDollarAvailability({ network: 'celo', goodDollarEnv: 'production', gdAddress: goodDollarTokens.development }).status).toBe('blocked');
    expect(goodDollarAvailability({ network: 'celo-sepolia', gdAddress: goodDollarTokens.production }).status).toBe('blocked');
  });
  it('infers the environment from the G$ token when it is not set explicitly', () => {
    expect(goodDollarAvailability({ network: 'celo', gdAddress: goodDollarTokens.production })).toEqual({ status: 'ready', env: 'production' });
    expect(goodDollarAvailability({ network: 'celo', gdAddress: goodDollarTokens.development })).toEqual({ status: 'ready', env: 'development' });
    expect(goodDollarAvailability({ network: 'celo' }).status).toBe('blocked');
    expect(goodDollarAvailability({ network: 'celo', gdAddress: '0x0000000000000000000000000000000000000001' }).status).toBe('blocked');
  });
  it('parses the official verification callback without trusting it as final state', () => {
    expect(readGoodDollarCallback('?isVerified=true')).toEqual({ status: 'verified' });
    expect(readGoodDollarCallback('?isVerified=false&reason=cancelled')).toEqual({ status: 'failed', reason: 'cancelled' });
    expect(readGoodDollarCallback('')).toEqual({ status: 'none' });
  });
});
