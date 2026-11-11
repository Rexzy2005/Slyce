'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSignMessage } from 'wagmi';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';

/**
 * Player nicknames (ADR-0017). Saving one signs a free message proving the wallet is yours (no prompt for email
 * accounts); the backend keeps names unique. The message must match backend/src/nickname-service.ts.
 */
export const nicknamePattern = /^[A-Za-z0-9_]{3,16}$/;
export const nicknameMessage = (address: string, nickname: string, issuedAt: string) => `Set my Slyyce nickname\nAddress: ${address.toLowerCase()}\nNickname: ${nickname}\nTime: ${issuedAt}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!publicConfig.backendUrl) throw new Error('Nicknames are not available right now.');
  const response = await apiFetch(`${publicConfig.backendUrl}/api/v1${path}`, init);
  const value = await response.json().catch(() => ({})) as { data?: T; error?: { message?: string } };
  if (!response.ok || !value.data) throw new Error(value.error?.message ?? 'Nicknames are not available right now.');
  return value.data;
}

export function useNickname(address: string | undefined) {
  return useQuery({
    queryKey: ['nickname', address?.toLowerCase()],
    queryFn: () => request<{ nickname: string | null }>(`/nicknames?address=${address}`).then(data => data.nickname),
    enabled: !!address,
    staleTime: 60_000,
  });
}

export function NicknameEditor({ address }: { address: string }) {
  const current = useNickname(address);
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const [value, setValue] = useState<string | null>(null);
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'saved' } | { status: 'error'; message: string }>({ status: 'idle' });
  const draft = value ?? current.data ?? '';
  const valid = nicknamePattern.test(draft.trim());
  async function save(event: FormEvent) {
    event.preventDefault();
    const nickname = draft.trim();
    if (!valid || state.status === 'saving') return;
    setState({ status: 'saving' });
    try {
      const issuedAt = new Date().toISOString();
      const signature = await signMessageAsync({ message: nicknameMessage(address, nickname, issuedAt) });
      await request('/nicknames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, nickname, issuedAt, signature }) });
      await queryClient.invalidateQueries({ queryKey: ['nickname'] });
      await queryClient.invalidateQueries({ queryKey: ['chain-leaderboard'] });
      setValue(null); setState({ status: 'saved' });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error && !/rejected|denied/i.test(error.message) ? error.message : 'Not saved. Try again.' });
    }
  }
  return <form className="nickname-form" onSubmit={event => void save(event)}>
    <label htmlFor="nickname">Nickname</label>
    <div className="nickname-row">
      <input id="nickname" value={draft} maxLength={16} autoComplete="nickname" placeholder="e.g. MelonMaster" onChange={event => { setValue(event.target.value); setState({ status: 'idle' }); }} disabled={state.status === 'saving' || current.isPending} />
      <button className="button" type="submit" disabled={!valid || state.status === 'saving' || draft.trim() === current.data}>{state.status === 'saving' ? 'Saving…' : 'Save'}</button>
    </div>
    {state.status === 'error' ? <p className="error-text" role="alert">{state.message}</p>
      : state.status === 'saved' ? <p className="leaf" role="status">Saved. This is how you'll appear on the leaderboard.</p>
      : draft && !valid ? <p className="muted fine-print">3–16 letters, numbers or underscores.</p> : null}
  </form>;
}
