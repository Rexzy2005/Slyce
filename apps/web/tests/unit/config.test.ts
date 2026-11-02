import { describe, expect, it } from 'vitest';
import { parsePublicConfig, serverConfigSchema } from '../../src/config/schema';
describe('configuration boundary', () => {
  it('allows the unconnected shell without inventing a network', () => { expect(parsePublicConfig({ network: '', rpcUrl: '' }).network).toBeUndefined(); });
  it('rejects partially configured Web3', () => { expect(() => parsePublicConfig({ network: 'celo' })).toThrow('rpcUrl'); expect(() => parsePublicConfig({ rpcUrl: 'https://example.com' })).toThrow('network'); });
  it('rejects malformed and zero deployment addresses', () => { for (const gdAddress of ['hello', '0x' + '0'.repeat(40)]) expect(() => parsePublicConfig({ network: 'celo', rpcUrl: 'https://example.com', gdAddress })).toThrow(); });
  it('does not accept short secrets or zero signer keys', () => { expect(serverConfigSchema.safeParse({ databaseUrl: 'postgres://localhost/db', sessionSecret: 'short', resultsSignerPrivateKey: '0x' + '0'.repeat(64) }).success).toBe(false); });
});
it('accepts only a Magic publishable key, and only with a network', () => {
  expect(parsePublicConfig({ network: 'celo', rpcUrl: 'https://forno.celo.org', magicPublishableKey: 'pk_live_ABC123' }).magicPublishableKey).toBe('pk_live_ABC123');
  expect(() => parsePublicConfig({ network: 'celo', rpcUrl: 'https://forno.celo.org', magicPublishableKey: 'sk_live_SECRET' })).toThrow(/Magic publishable key/);
  expect(() => parsePublicConfig({ magicPublishableKey: 'pk_live_ABC123' })).toThrow(/network/);
});
