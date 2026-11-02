'use client';
import { lazy, Suspense, type ReactNode } from 'react';
import { publicConfig } from '../config/public';
import { WalletContext } from './context';
const MagicProvider = lazy(() => import('./magic-provider'));
/** Shown while the sign-in bundle loads; the sign-in gate renders a loading screen, never app content. */
const loading = { status: 'connecting', wrongNetwork: false, balance: { status: 'unavailable' } } as const;
export function Web3Provider({ children }: { children: ReactNode }) {
  if (publicConfig.network && publicConfig.rpcUrl && publicConfig.magicPublishableKey) return <Suspense fallback={<WalletContext value={loading}>{children}</WalletContext>}><MagicProvider>{children}</MagicProvider></Suspense>;
  return <WalletContext value={{ status: 'unavailable', wrongNetwork: false, balance: { status: 'unavailable' }, message: 'Sign-in is not configured for this environment.' }}>{children}</WalletContext>;
}
