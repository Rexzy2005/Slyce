'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider, createConfig, http, type Config } from 'wagmi';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';
import type { Magic } from 'magic-sdk';
import type { Chain } from 'viem';
import { publicConfig } from '../config/public';
import { chainFor } from './config';
import { ConnectedState } from './connected-state';
import { getMagic, magicConnector } from './magic';
import { MagicContext } from './magic-context';
import { WalletContext } from './context';

let created: { config: Config; magic: Magic } | undefined;
/** Browser-only (called after hydration). Module-level so remounts (Strict Mode, layout changes) never create a second Magic iframe or wagmi config. */
function createWallets() {
  if (created) return created;
  if (!publicConfig.network || !publicConfig.rpcUrl || !publicConfig.magicPublishableKey) throw new Error('Sign-in configuration is incomplete');
  // Widened to Chain so wagmi types the transports map for this one configured network.
  const chain: Chain = chainFor(publicConfig.network);
  const magic = getMagic(publicConfig.magicPublishableKey, chain, publicConfig.rpcUrl);
  // Email (Magic) first. Wallet players pick from: wallets detected in the browser (EIP-6963, added by wagmi),
  // MetaMask and Coinbase Wallet (open their apps on phones), and WalletConnect for every other wallet app.
  const origin = window.location.origin;
  const connectors = [
    magicConnector(magic),
    injected({ shimDisconnect: true }),
    metaMask({ dappMetadata: { name: 'Slyyce', url: origin, iconUrl: origin + '/icons/icon-192.png' } }),
    coinbaseWallet({ appName: 'Slyyce', appLogoUrl: origin + '/icons/icon-192.png' }),
    ...(publicConfig.walletConnectProjectId ? [walletConnect({ projectId: publicConfig.walletConnectProjectId, showQrModal: true, metadata: { name: 'Slyyce', description: 'Swipe. Slice. Stack your G$.', url: origin, icons: [origin + '/icons/icon-192.png'] } })] : []),
  ];
  const config = createConfig({ chains: [chain], connectors, transports: { [chain.id]: http(publicConfig.rpcUrl) }, ssr: true });
  created = { config, magic };
  return created;
}

const loading = { status: 'connecting', wrongNetwork: false, balance: { status: 'unavailable' } } as const;

export default function MagicProvider({ children }: { children: ReactNode }) {
  // Magic needs the browser (it mounts an iframe), so it is created after hydration; until then the gate shows "loading".
  const [wallets, setWallets] = useState<ReturnType<typeof createWallets>>();
  useEffect(() => { setWallets(createWallets()); }, []);
  if (!wallets) return <WalletContext value={loading}>{children}</WalletContext>;
  const { config, magic } = wallets;
  return <MagicContext value={magic}><WagmiProvider config={config} reconnectOnMount><ConnectedState>{children}</ConnectedState></WagmiProvider></MagicContext>;
}
