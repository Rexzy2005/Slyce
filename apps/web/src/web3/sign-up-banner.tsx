'use client';
import { useState } from 'react';
import { useSignMessage } from 'wagmi';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { useWallet } from './context';

/**
 * Asks a newly signed-in player to sign one free message so the backend records the sign-up
 * (proves wallet ownership; no transaction, no fee). Shown once per wallet per device.
 */
const storageKey = (address: string) => `slyyce.signup.v1.${address.toLowerCase()}`;
function read(key: string): boolean { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } }
function remember(key: string) { try { window.localStorage.setItem(key, '1'); } catch { /* storage unavailable: ask again next visit */ } }

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(`${publicConfig.backendUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  const value = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || !value.data) throw new Error(value.error?.message ?? 'Sign-up could not be confirmed.');
  return value.data;
}

export function SignUpBanner() {
  const wallet = useWallet();
  if (!wallet.live || wallet.status !== 'connected' || !wallet.address || !publicConfig.backendUrl) return null;
  return <SignUpPrompt address={wallet.address} />;
}

function SignUpPrompt({ address }: { address: string }) {
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'later' | 'error'>(() => read(storageKey(address)) ? 'done' : 'idle');
  const [message, setMessage] = useState('');
  if (state === 'done' || state === 'later') return null;
  // Magic sign-in is email only (ADR-0014).
  const signInMethod = 'email';

  async function confirm() {
    setState('busy'); setMessage('');
    try {
      const origin = window.location.origin;
      const challenge = await post<{ chainId: number; nonce: string; message: string }>('/api/v1/auth/wallet/challenge', { address, chainId: 42220, origin });
      const signature = await signMessageAsync({ message: challenge.message });
      await post('/api/v1/auth/wallet/verify', { address, chainId: challenge.chainId, origin, nonce: challenge.nonce, signature, signInMethod });
      remember(storageKey(address));
      setState('done');
    } catch (error) {
      setMessage(error instanceof Error && !/reject|denied/i.test(error.message) ? error.message : 'Not confirmed. You can try again any time.');
      setState('error');
    }
  }

  return <div className="gas-banner sign-up-banner" role="status">
    <strong>Finish signing up</strong>
    <span>Tap to confirm it's you. It's free.</span>
    {message && <span className="error-text">{message}</span>}
    <span className="sign-up-actions">
      <button className="button" disabled={state === 'busy'} onClick={() => void confirm()}>{state === 'busy' ? 'Confirming…' : 'Confirm'}</button>
      <button className="text-button" disabled={state === 'busy'} onClick={() => setState('later')}>Later</button>
    </span>
  </div>;
}
