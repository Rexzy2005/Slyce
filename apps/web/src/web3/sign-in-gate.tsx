'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useConnect, useSwitchChain } from 'wagmi';
import { publicConfig } from '../config/public';
import { chainFor } from './config';
import { Icon } from '../components/icon';
import { LoadingScreen } from '../components/loading-screen';
import { useGameRecords } from '../game/game-records';
import { useWallet } from './context';
import { useMagic } from './magic-context';
/** Every app screen requires a signed-in account: email with a one-time code (Magic, ADR-0014) or an existing wallet. */
export function SignInGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  if (wallet.status === 'unavailable') return <div className="sign-in-screen"><SignInHero /><p className="error-text" role="alert">{wallet.message ?? 'Sign-in is not available right now.'}</p></div>;
  if (wallet.status === 'connected' && !wallet.wrongNetwork) return <>{children}</>;
  if (wallet.status === 'connected' && wallet.wrongNetwork && wallet.live) return <SwitchNetwork />;
  // Also covers the moment before the sign-in bundle mounts, so Magic is never used early.
  if (wallet.status === 'connecting' || !wallet.live) return <div className="sign-in-screen"><LoadingScreen message="Signing you in" detail="Hang tight." compact /></div>;
  return <SignIn />;
}
function SignInHero() {
  return <><span className="brand sign-in-brand">slyyce<span className="brand-dot">/</span></span>
    <Image className="sign-in-art" src="/game/fruit-splash-v1.webp" alt="" width={1672} height={941} priority unoptimized />
    <h1>Swipe. Slice.<br /><span>Stack your G$.</span></h1></>;
}
const network = publicConfig.network ? chainFor(publicConfig.network) : undefined;
function SwitchNetwork() {
  const { switchChainAsync, isPending } = useSwitchChain();
  const [failed, setFailed] = useState(false);
  return <div className="sign-in-screen"><SignInHero />
    <p>Your wallet is set to a different network. Switch it to {network?.name ?? 'Celo'} to play.</p>
    <button className="button sign-in-action" disabled={isPending || !network} onClick={() => { setFailed(false); if (network) void switchChainAsync({ chainId: network.id }).catch(() => setFailed(true)); }}>{isPending ? 'Switching…' : 'Switch network'}</button>
    {failed && <p className="error-text" role="alert">Your wallet didn't switch. Change the network in your wallet app, then come back.</p>}</div>;
}
function SignIn() {
  const magic = useMagic();
  const { connectAsync, connectors } = useConnect();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [walletState, setWalletState] = useState<'idle' | 'busy' | 'error' | 'none'>('idle');
  /** A wallet built into the browser (MetaMask, MiniPay, Valora's browser) if present, else WalletConnect for mobile wallet apps. */
  async function connectWallet() {
    const browserWallet = typeof window !== 'undefined' && 'ethereum' in window ? connectors.find(item => item.id === 'injected') : undefined;
    const connector = browserWallet ?? connectors.find(item => item.id === 'walletConnect');
    if (!connector) { setWalletState('none'); return; }
    setWalletState('busy');
    try { await connectAsync({ connector, ...(network ? { chainId: network.id } : {}) }); setWalletState('idle'); } catch { setWalletState('error'); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const connector = connectors.find(item => item.id === 'magic');
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
    <div className="sign-in-divider" aria-hidden="true"><span>or</span></div>
    <button className="button secondary sign-in-wallet" type="button" disabled={walletState === 'busy' || state === 'busy'} onClick={() => void connectWallet()}>{walletState === 'busy' ? 'Opening your wallet…' : 'I already have a wallet'}</button>
    {walletState === 'error' && <p className="error-text" role="alert">Your wallet didn't connect. Try again, or use your email.</p>}
    {walletState === 'none' && <p className="error-text" role="alert">No wallet found. Open Slyyce in your wallet app's browser, or sign in with email.</p>}
    <small className="muted">Free to play. Only verified real people can play and earn G$.</small></div>;
}

/** Pages a signed-in but unverified player may still open: verification itself and their account. */
const openToUnverified = ['/get-gd', '/profile'];
const verifiedKey = (address: string) => `slyyce.verified.v1.${address.toLowerCase()}`;
function rememberedVerified(address: string | undefined): boolean {
  if (!address) return false;
  try { return window.localStorage.getItem(verifiedKey(address)) === '1'; } catch { return false; }
}
function rememberVerified(address: string, verified: boolean) {
  try { if (verified) window.localStorage.setItem(verifiedKey(address), '1'); else window.localStorage.removeItem(verifiedKey(address)); } catch { /* storage unavailable: re-check next visit */ }
}
/**
 * Only GoodDollar-verified people play (product decision 2026-11-02); everyone else is sent to verify first.
 * A player verified before on this device goes straight in while the check re-runs quietly; if their
 * GoodDollar verification has expired, the verify screen appears once the check finishes.
 */
export function VerifiedGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const pathname = usePathname();
  const records = useGameRecords(wallet.address);
  const address = wallet.address;
  const [remembered] = useState(() => rememberedVerified(address));
  useEffect(() => { if (address && records.verified !== undefined) rememberVerified(address, records.verified); }, [address, records.verified]);
  if (openToUnverified.some(path => pathname.startsWith(path)) || records.verified === true || (records.verified === undefined && remembered)) return <>{children}</>;
  if (records.verified === undefined) return <LoadingScreen message="Checking your account" detail="One moment." compact />;
  return <section className="panel verify-gate">
    <span className="eyebrow">ONE QUICK STEP</span>
    <h1>Verify you're a real person</h1>
    <p>Slyyce is only for real people. Verify once with GoodDollar (a quick face check, under a minute) and you can play, win G$ and claim free G$ every day.</p>
    <Link className="button" href="/get-gd">Verify now</Link>
  </section>;
}
