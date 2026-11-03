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
type WalletConnector = { id: string; name: string; type: string; icon?: string | undefined };
export type WalletOption = { connectorId: string; label: string; hint?: string; icon?: string };
/**
 * Wallet choices for the Wallet tab: wallets detected in this browser (EIP-6963, with their own name and icon),
 * MetaMask and Coinbase Wallet (open their apps on phones) unless already detected, a plain browser wallet when
 * one exists without EIP-6963 (e.g. MiniPay), and WalletConnect for every other wallet app.
 */
export function walletOptions(connectors: readonly WalletConnector[], hasBrowserWallet: boolean): WalletOption[] {
  const detected = connectors.filter(item => item.type === 'injected' && item.id !== 'injected');
  const detectedIds = new Set(detected.map(item => item.id));
  const options: WalletOption[] = detected.map(item => ({ connectorId: item.id, label: item.name, ...(item.icon ? { icon: item.icon } : {}) }));
  if (detected.length === 0 && hasBrowserWallet && connectors.some(item => item.id === 'injected')) options.push({ connectorId: 'injected', label: 'Browser wallet', hint: 'The wallet in this app or browser' });
  if (!detectedIds.has('io.metamask') && connectors.some(item => item.id === 'metaMaskSDK')) options.push({ connectorId: 'metaMaskSDK', label: 'MetaMask' });
  if (!detectedIds.has('com.coinbase.wallet') && connectors.some(item => item.id === 'coinbaseWalletSDK')) options.push({ connectorId: 'coinbaseWalletSDK', label: 'Coinbase Wallet' });
  if (connectors.some(item => item.id === 'walletConnect')) options.push({ connectorId: 'walletConnect', label: 'Other wallets', hint: 'Valora, Trust, MiniPay and 140+ more' });
  return options;
}
function SignIn() {
  const [mode, setMode] = useState<'email' | 'wallet'>('email');
  return <div className="sign-in-screen"><SignInHero />
    <div className="segmented sign-in-toggle" role="tablist" aria-label="Sign in with">
      <button type="button" role="tab" aria-selected={mode === 'email'} aria-pressed={mode === 'email'} onClick={() => setMode('email')}>Email</button>
      <button type="button" role="tab" aria-selected={mode === 'wallet'} aria-pressed={mode === 'wallet'} onClick={() => setMode('wallet')}>Wallet</button>
    </div>
    {mode === 'email' ? <EmailSignIn /> : <WalletSignIn />}
    <small className="muted">Free to play. Only verified real people can play and earn G$.</small></div>;
}
function EmailSignIn() {
  const magic = useMagic();
  const { connectAsync, connectors } = useConnect();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
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
  return <>
    <p>Sign in with your email. We'll send you a one-time code. No password needed.</p>
    <form className="sign-in-form" onSubmit={event => void submit(event)}>
      <label className="sr-only" htmlFor="sign-in-email">Email address</label>
      <input id="sign-in-email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={state === 'busy'} />
      <button className="button sign-in-action" type="submit" disabled={state === 'busy' || !email.trim()}><Icon name="user" /> {state === 'busy' ? 'Check your email…' : 'Continue'}</button>
    </form>
    {state === 'error' && <p className="error-text" role="alert">That didn't work. Check the code and try again.</p>}
  </>;
}
function WalletSignIn() {
  const { connectAsync, connectors } = useConnect();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const options = walletOptions(connectors, typeof window !== 'undefined' && 'ethereum' in window);
  async function choose(option: WalletOption) {
    const connector = connectors.find(item => item.id === option.connectorId);
    if (!connector || busy) return;
    setBusy(option.connectorId); setFailed(false);
    try { await connectAsync({ connector, ...(network ? { chainId: network.id } : {}) }); } catch { setFailed(true); }
    setBusy(null);
  }
  return <>
    <p>Choose your wallet to continue.</p>
    {options.length === 0
      ? <p className="error-text" role="alert">No wallet found. Open Slyyce in your wallet app's browser, or sign in with email.</p>
      : <ul className="wallet-options">{options.map(option => <li key={option.connectorId}>
          <button type="button" className="wallet-option" disabled={busy !== null} onClick={() => void choose(option)}>
            {option.icon ? <img src={option.icon} alt="" width={32} height={32} /> : <span className="wallet-option-badge" aria-hidden="true">{option.label.charAt(0)}</span>}
            <span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>
            <span className="wallet-option-go" aria-hidden="true">{busy === option.connectorId ? '…' : '→'}</span>
          </button>
        </li>)}</ul>}
    {failed && <p className="error-text" role="alert">Your wallet didn't connect. Try again, or pick another wallet.</p>}
  </>;
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
