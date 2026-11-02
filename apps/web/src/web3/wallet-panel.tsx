'use client';
import { useWallet } from './context';
import { SignOutButton, useSignedInEmail } from './account-button';
/** Balance and account; plain language only (no addresses or networks shown to players). */
export function WalletPanel() {
  const wallet = useWallet();
  return <section className="wallet-panel" aria-label="Your account">
    <div><span className="eyebrow">YOUR BALANCE</span><p className="balance">{wallet.balance.status === 'ready' ? wallet.balance.formatted + ' G$' : wallet.balance.status === 'loading' ? 'Loading G$…' : 'G$ balance unavailable'}</p></div>
    {wallet.live && <SignedInAs />}
    {wallet.balance.status === 'offline' && <p role="status">You’re offline. Reconnect to refresh your G$ balance.</p>}
    {wallet.balance.status === 'error' && <p role="status">Your balance couldn't be loaded right now.</p>}
  </section>;
}
function SignedInAs() {
  const email = useSignedInEmail();
  return <div className="wallet-panel-account">{email && <p className="muted">Signed in as <strong>{email}</strong></p>}<SignOutButton /></div>;
}
