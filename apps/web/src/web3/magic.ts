'use client';
import { Magic } from 'magic-sdk';
import { createConnector } from 'wagmi';
import { getAddress, type Address, type Chain } from 'viem';

/**
 * Magic email sign-in (ADR-0014). Magic creates one embedded wallet per email and signs
 * requests in its iframe; wagmi talks to it through this connector, so the rest of the app
 * (balances, contract writes) is unchanged. Browser-only: the module is loaded lazily.
 */
let instance: Magic | undefined;
export function getMagic(publishableKey: string, chain: Chain, rpcUrl: string): Magic {
  instance ??= new Magic(publishableKey, { network: { rpcUrl, chainId: chain.id } });
  return instance;
}

async function accountsOf(magic: Magic): Promise<readonly Address[]> {
  const accounts = await magic.rpcProvider.request<string[]>({ method: 'eth_accounts', params: [] });
  return accounts.map(account => getAddress(account));
}

const authCheckTimeoutMs = 8000;
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

export function magicConnector(magic: Magic) {
  return createConnector(config => ({
    id: 'magic',
    name: 'Email',
    type: 'magic',
    async connect({ withCapabilities } = {}) {
      // Login happens first through signInWithEmail; connecting only reads the signed-in wallet.
      if (!await magic.user.isLoggedIn()) throw new Error('Sign in with your email first.');
      const accounts = await accountsOf(magic);
      const chainId = config.chains[0].id;
      // The return type depends on the generic `withCapabilities`; wagmi's own connectors narrow it the same way.
      return { accounts: (withCapabilities ? accounts.map(address => ({ address, capabilities: {} })) : accounts) as never, chainId };
    },
    async disconnect() { await magic.user.logout(); },
    getAccounts: () => accountsOf(magic),
    getChainId: async () => config.chains[0].id,
    getProvider: async () => magic.rpcProvider,
    // If Magic can't answer (offline, blocked iframe), treat the player as signed out instead of waiting forever.
    isAuthorized: async () => { try { return await withTimeout(magic.user.isLoggedIn(), authCheckTimeoutMs, false); } catch { return false; } },
    onAccountsChanged(accounts) { if (accounts.length === 0) config.emitter.emit('disconnect'); else config.emitter.emit('change', { accounts: accounts.map(account => getAddress(account)) }); },
    onChainChanged() { /* single network */ },
    onDisconnect() { config.emitter.emit('disconnect'); },
  }));
}

/** Sends the one-time code (Magic's own dialog collects it) and resolves once the player is signed in. */
export async function signInWithEmail(magic: Magic, email: string): Promise<void> {
  await magic.auth.loginWithEmailOTP({ email, showUI: true });
}

export async function signedInEmail(magic: Magic): Promise<string | null> {
  try { return (await magic.user.getInfo()).email; } catch { return null; }
}
