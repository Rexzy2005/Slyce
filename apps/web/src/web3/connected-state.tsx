'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { parseEther } from 'viem';
import { erc20Abi } from 'viem';
import { publicConfig } from '../config/public';
import { chainFor, contractsFor } from './config';
import { WalletContext, type WalletState } from './context';
import { formatTokenAmount } from './units';
import { useOnlineStatus } from './online-status';
/** Below this, a new wallet likely can't pay Celo network fees for a few transactions. */
const lowGas = parseEther('0.005');
/** Upper bound for wagmi to restore a saved session on page load before we show "signed out". */
const restoreTimeoutMs = 4000;
/**
 * wagmi reports "disconnected" for a moment on page load before it starts restoring the saved session.
 * Treat that window as connecting so the sign-in gate never flashes or bounces a signed-in player.
 */
export function sessionStatus(account: { status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' }, restoring: boolean): 'connected' | 'connecting' | 'disconnected' {
  if (account.status === 'connected') return 'connected';
  if (account.status === 'connecting' || account.status === 'reconnecting' || restoring) return 'connecting';
  return 'disconnected';
}
export function ConnectedState({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [restoring, setRestoring] = useState(true);
  const sawReconnect = useRef(false);
  useEffect(() => {
    if (account.status === 'reconnecting' || account.status === 'connecting') sawReconnect.current = true;
    else if (account.status === 'connected' || sawReconnect.current) setRestoring(false);
  }, [account.status]);
  useEffect(() => { const timer = setTimeout(() => setRestoring(false), restoreTimeoutMs); return () => clearTimeout(timer); }, []);
  const online = useOnlineStatus();
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const token = contractsFor(publicConfig).gd;
  const wrongNetwork = account.isConnected && account.chainId !== chain?.id;
  const balance = useReadContracts({
    contracts: token && account.address && chain ? [
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account.address], chainId: chain.id },
      { address: token, abi: erc20Abi, functionName: 'decimals', chainId: chain.id },
    ] : [],
    allowFailure: false,
    query: { enabled: online && !!token && account.isConnected && !wrongNetwork, staleTime: 0, refetchOnWindowFocus: true },
  });
  const native = useBalance({ address: account.address, chainId: chain?.id, query: { enabled: online && account.isConnected && !wrongNetwork && !!chain, refetchInterval: 30_000 } });
  const raw = balance.data?.[0];
  const decimals = balance.data?.[1];
  const balanceState: WalletState['balance'] = !online ? { status: 'offline' } : !token || !account.isConnected || wrongNetwork ? { status: 'unavailable' }
    : balance.isError ? { status: 'error' }
    : typeof raw === 'bigint' && typeof decimals === 'number' ? { status: 'ready', formatted: formatTokenAmount(raw, decimals), raw }
    : { status: 'loading' };
  const value: WalletState = {
    status: sessionStatus(account, restoring),
    ...(account.address ? { address: account.address } : {}), wrongNetwork, balance: balanceState,
    gas: native.data === undefined ? 'unknown' : native.data.value < lowGas ? 'low' : 'ok',
    refreshBalance: () => { void balance.refetch(); void native.refetch(); },
  };
  return <WalletContext value={value}>{children}</WalletContext>;
}
