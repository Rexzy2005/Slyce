'use client';
import { useEffect } from 'react';
import { useSignMessage } from 'wagmi';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { useWallet } from './context';

/**
 * Records the sign-up with the backend right after sign-in, with no prompt: the embedded wallet signs one
 * free message proving ownership (ADR-0013). No transaction, no fee.
 */
const storageKey = (address: string) => `slyyce.signup.v1.${address.toLowerCase()}`;
function read(key: string): boolean { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } }
function remember(key: string) { try { window.localStorage.setItem(key, '1'); } catch { /* storage unavailable: record again next visit */ } }
/** Guards against repeat attempts within one page session (remounts, Strict Mode). */
const attempted = new Set<string>();

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(`${publicConfig.backendUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  const value = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || !value.data) throw new Error(value.error?.message ?? 'Sign-up could not be confirmed.');
  return value.data;
}

export function SignUpRecorder() {
  const wallet = useWallet();
  if (!wallet.live || wallet.status !== 'connected' || !wallet.address || !publicConfig.backendUrl) return null;
  return <RecordSignUp address={wallet.address} />;
}

/** Runs once per wallet per device, in the background; a failure is retried silently on the next visit. */
function RecordSignUp({ address }: { address: string }) {
  const { signMessageAsync } = useSignMessage();
  useEffect(() => {
    const key = storageKey(address);
    if (read(key) || attempted.has(key)) return;
    attempted.add(key);
    void (async () => {
      try {
        const origin = window.location.origin;
        const challenge = await post<{ chainId: number; nonce: string; message: string }>('/api/v1/auth/wallet/challenge', { address, chainId: 42220, origin });
        const signature = await signMessageAsync({ message: challenge.message });
        // Magic sign-in is email only (ADR-0014).
        await post('/api/v1/auth/wallet/verify', { address, chainId: challenge.chainId, origin, nonce: challenge.nonce, signature, signInMethod: 'email' });
        remember(key);
      } catch { /* not recorded this time; try again next visit */ }
    })();
  }, [address, signMessageAsync]);
  return null;
}
