'use client';
import { useState, type ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { celo, celoSepolia } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { publicConfig } from '../config/public';
import tokens from '../design/tokens.json';
import { ConnectedState } from './connected-state';
/**
 * Reown AppKit: email login (embedded wallet; Celo is supported, see docs/research/reown-appkit.md) or an external wallet.
 * Created once per page load; AppKit keeps one global modal instance.
 */
type AppKitAdapter = NonNullable<Parameters<typeof createAppKit>[0]['adapters']>[number];
/**
 * WagmiAdapter's published types mark `namespace`/`adapterType` optional, which conflicts with this repo's
 * exactOptionalPropertyTypes. Verify the fields at runtime instead of casting.
 */
function isAppKitAdapter(adapter: object): adapter is AppKitAdapter {
  return 'namespace' in adapter && adapter.namespace === 'eip155' && 'adapterType' in adapter && typeof adapter.adapterType === 'string';
}
let wallets: WagmiAdapter | undefined;
/** Module-level so remounts (Strict Mode, layout changes) never create a second AppKit or wagmi config. */
function createWallets() {
  if (wallets) return wallets;
  if (!publicConfig.network || !publicConfig.rpcUrl || !publicConfig.walletConnectProjectId || !publicConfig.appUrl) throw new Error('Wallet configuration is incomplete');
  const network = publicConfig.network === 'celo' ? celo : celoSepolia;
  const origin = publicConfig.appUrl;
  const adapter = new WagmiAdapter({ networks: [network], projectId: publicConfig.walletConnectProjectId, ssr: true, transports: { [network.id]: http(publicConfig.rpcUrl) } });
  if (!isAppKitAdapter(adapter)) throw new Error('Unexpected wallet adapter namespace');
  createAppKit({
    adapters: [adapter], networks: [network], defaultNetwork: network, projectId: publicConfig.walletConnectProjectId,
    metadata: { name: 'Slyyce', description: 'Swipe. Slice. Stack your G$.', url: origin, icons: [origin + '/icons/icon-192.png'] },
    features: { email: true, emailShowWallets: true, socials: false, analytics: false, swaps: false, onramp: false, connectMethodsOrder: ['email', 'wallet'] },
    allowUnsupportedChain: false, themeMode: 'dark', themeVariables: { '--w3m-accent': tokens.mango, '--w3m-font-family': 'Rajdhani, system-ui, sans-serif' },
  });
  wallets = adapter;
  return adapter;
}
export default function AppKitProvider({ children }: { children: ReactNode }) {
  const [adapter] = useState(createWallets);
  return <WagmiProvider config={adapter.wagmiConfig}><ConnectedState>{children}</ConnectedState></WagmiProvider>;
}
