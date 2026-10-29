'use client';
import { useAppKit } from '@reown/appkit/react';
import { Icon } from '../components/icon';
import { useWallet } from './context';
/** Opens the Reown modal: sign in when disconnected, account details when connected. */
export function AccountButton() {
  const wallet = useWallet();
  if (!wallet.live) return <span className="account-chip muted" title={wallet.message}><Icon name="wallet" />Offline mode</span>;
  return <ConnectedAccountButton />;
}
function ConnectedAccountButton() {
  const wallet = useWallet();
  const { open } = useAppKit();
  if (wallet.status === 'connected' && wallet.address) return <button className="account-chip" onClick={() => void open({ view: 'Account' })} aria-label="Account"><Icon name="user" />{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</button>;
  return <button className="account-chip" onClick={() => void open()} disabled={wallet.status === 'connecting'}><Icon name="wallet" />{wallet.status === 'connecting' ? 'Connecting…' : 'Sign in'}</button>;
}
