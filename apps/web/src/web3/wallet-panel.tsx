'use client';
import { useWallet } from './context';
import { SignOutButton, useSignedInEmail } from './account-button';
/** Balance and account; plain language only (no addresses or networks shown to players). */
export function WalletPanel() {
  const wallet = useWallet();
  const balance = wallet.balance.status === 'ready' ? wallet.balance.formatted + ' G$' : wallet.balance.status === 'loading' ? 'Loading G$…' : 'G$ balance unavailable';
  return <section className="wallet-panel" aria-label="Your account">
    <div className="wallet-panel-balance"><span className="eyebrow">YOUR BALANCE</span><p className="balance" title={wallet.balance.status === 'ready' ? balance : undefined}>{balance}</p></div>
    {wallet.live && <SignedInAs />}
    {wallet.balance.status === 'offline' && <p role="status">You’re offline. Reconnect to refresh your G$ balance.</p>}
    {wallet.balance.status === 'error' && <p role="status">Your balance couldn't be loaded right now.</p>}
  </section>;
}
function SignedInAs() {
  const email = useSignedInEmail();
  return <div className="wallet-panel-account">{email && <div className="wallet-account-identity"><span className="wallet-account-label">SIGNED IN</span><strong className="wallet-account-email" title={email}>{email}</strong></div>}<SignOutButton /></div>;
}
