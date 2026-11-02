'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useConnect } from 'wagmi';
import { Icon } from '../components/icon';
import { LoadingScreen } from '../components/loading-screen';
import { useGameRecords } from '../game/game-records';
import { useWallet } from './context';
import { useMagic } from './magic-context';
/** Every app screen requires a signed-in account (email with a one-time code, via Magic; ADR-0014). */
export function SignInGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  if (wallet.status === 'unavailable') return <div className="sign-in-screen"><SignInHero /><p className="error-text" role="alert">{wallet.message ?? 'Sign-in is not available right now.'}</p></div>;
  if (wallet.status === 'connected' && !wallet.wrongNetwork) return <>{children}</>;
  // Also covers the moment before the sign-in bundle mounts, so Magic is never used early.
  if (wallet.status === 'connecting' || !wallet.live) return <div className="sign-in-screen"><LoadingScreen message="Signing you in" detail="Hang tight." compact /></div>;
  return <SignIn />;
}
function SignInHero() {
  return <><span className="brand sign-in-brand">slyyce<span className="brand-dot">/</span></span>
    <Image className="sign-in-art" src="/game/fruit-splash-v1.webp" alt="" width={1672} height={941} priority unoptimized />
    <h1>Swipe. Slice.<br /><span>Stack your G$.</span></h1></>;
}
function SignIn() {
  const magic = useMagic();
  const { connectAsync, connectors } = useConnect();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const connector = connectors[0];
    if (!magic || !connector || state === 'busy') return;
    setState('busy');
    try {
      const { signInWithEmail } = await import('./magic');
      await signInWithEmail(magic, email.trim());
      await connectAsync({ connector });
    } catch { setState('error'); return; }
    setState('idle');
  }
  return <div className="sign-in-screen"><SignInHero />
    <p>Sign in with your email. We'll send you a one-time code. No password needed.</p>
    <form className="sign-in-form" onSubmit={event => void submit(event)}>
      <label className="sr-only" htmlFor="sign-in-email">Email address</label>
      <input id="sign-in-email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={state === 'busy'} />
      <button className="button sign-in-action" type="submit" disabled={state === 'busy' || !email.trim()}><Icon name="user" /> {state === 'busy' ? 'Check your email…' : 'Continue'}</button>
    </form>
    {state === 'error' && <p className="error-text" role="alert">That didn't work. Check the code and try again.</p>}
    <small className="muted">Free to play. Only verified real people can play and earn G$.</small></div>;
}

/** Pages a signed-in but unverified player may still open: verification itself and their account. */
const openToUnverified = ['/get-gd', '/profile'];
/** Only GoodDollar-verified people play (product decision 2026-11-02); everyone else is sent to verify first. */
export function VerifiedGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const pathname = usePathname();
  const records = useGameRecords(wallet.address);
  if (openToUnverified.some(path => pathname.startsWith(path)) || records.verified === true) return <>{children}</>;
  if (records.verified === undefined) return <LoadingScreen message="Checking your account" detail="One moment." compact />;
  return <section className="panel verify-gate">
    <span className="eyebrow">ONE QUICK STEP</span>
    <h1>Verify you're a real person</h1>
    <p>Slyyce is only for real people. Verify once with GoodDollar (a quick face check, under a minute) and you can play, win G$ and claim free G$ every day.</p>
    <Link className="button" href="/get-gd">Verify now</Link>
  </section>;
}
