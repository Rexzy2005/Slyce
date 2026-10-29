'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { Icon } from '../components/icon';
import { LoadingScreen } from '../components/loading-screen';
import { useWallet } from './context';
/** Every app screen requires a signed-in account: email (embedded wallet) or an external wallet. */
export function SignInGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  if (wallet.status === 'unavailable') return <div className="sign-in-screen"><SignInHero /><p className="error-text" role="alert">{wallet.message ?? 'Sign-in is not configured for this environment.'}</p></div>;
  if (wallet.status === 'connected' && !wallet.wrongNetwork) return <>{children}</>;
  // Also covers the moment before the wallet bundle mounts AppKit, so useAppKit never runs early.
  if (wallet.status === 'connecting') return <div className="sign-in-screen"><LoadingScreen message="Signing you in" detail="Hang tight." compact /></div>;
  return <SignIn />;
}
function SignInHero() {
  return <><span className="brand sign-in-brand">slyyce<span className="brand-dot">/</span></span>
    <Image className="sign-in-art" src="/game/fruit-splash-v1.webp" alt="" width={1672} height={941} priority unoptimized />
    <h1>Swipe. Slice.<br /><span>Stack your G$.</span></h1></>;
}
function SignIn() {
  const wallet = useWallet();
  const { open } = useAppKit();
  return <div className="sign-in-screen"><SignInHero />
    {wallet.wrongNetwork
      ? <><p>Your wallet is on a different network. Switch to Celo to play.</p><button className="button sign-in-action" onClick={() => void open({ view: 'Networks' })}><Icon name="reset" /> Switch to Celo</button></>
      : <><p>Sign in with your email or connect a wallet. Email sign-in creates a secure wallet for you automatically.</p>
        <button className="button sign-in-action" onClick={() => void open()}><Icon name="user" /> Sign in with email or wallet</button></>}
    <small className="muted">Rounds cost a small G$ fee. New here? Verify with GoodDollar to claim free G$ every day.</small></div>;
}
