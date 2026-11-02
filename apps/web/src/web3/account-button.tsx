'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDisconnect } from 'wagmi';
import { Icon } from '../components/icon';
import { useWallet } from './context';
import { useMagic } from './magic-context';
/** The signed-in player's email, read from Magic (null while loading or signed out). */
export function useSignedInEmail(): string | null {
  const magic = useMagic();
  const wallet = useWallet();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!magic || wallet.status !== 'connected') return;
    let active = true;
    void import('./magic').then(({ signedInEmail }) => signedInEmail(magic)).then(value => { if (active) setEmail(value); });
    return () => { active = false; };
  }, [magic, wallet.status]);
  return wallet.status === 'connected' ? email : null;
}
/** Header chip: who is signed in; opens the profile, where they can sign out. */
export function AccountButton() {
  const wallet = useWallet();
  if (!wallet.live) return null;
  return <SignedInChip />;
}
function SignedInChip() {
  const email = useSignedInEmail();
  return <Link className="account-chip" href="/profile" aria-label="Your account"><Icon name="user" />{email ? email.split('@')[0] : 'Account'}</Link>;
}
export function SignOutButton() {
  const { disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);
  return <button className="button secondary" disabled={busy} onClick={() => { setBusy(true); void disconnectAsync().finally(() => setBusy(false)); }}>{busy ? 'Signing out…' : 'Sign out'}</button>;
}
