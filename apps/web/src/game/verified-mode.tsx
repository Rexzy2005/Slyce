'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSignMessage } from 'wagmi';
import { publicConfig } from '../config/public';
import { apiFetch } from '../api/http';
import { useWallet } from '../web3/context';
import { simulateVerifiedFruitSlice, verifiedFruitSliceTargets, verifiedFruitSliceGameMode, verifiedFruitSliceRulesVersion, type ReplayInput } from '@slyyce/shared/verified-game';

type Session = { id: string; seed: string; expiresAt: string };
type Result = { status: 'verified' | 'rejected'; score?: number; reason?: string };

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  if (!publicConfig.backendUrl) throw new Error('The gameplay service is not configured.');
  const response = await apiFetch(`${publicConfig.backendUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const value = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || !value.data) throw new Error(value.error?.message ?? 'The gameplay service could not complete the request.');
  return value.data;
}

async function digestReplayInputs(inputs: readonly ReplayInput[]): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(inputs)));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function VerifiedMode() {
  const wallet = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [inputs, setInputs] = useState<ReplayInput[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const board = useRef<HTMLDivElement>(null);

  const targets = useMemo(() => session ? verifiedFruitSliceTargets(session.seed) : [], [session]);
  const elapsed = () => startedAt === null ? 0 : Math.min(30_000, Date.now() - startedAt);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => refresh(value => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [session]);

  async function enable() {
    if (!wallet.address || !publicConfig.backendUrl) return;
    setBusy(true); setResult(null);
    try {
      const origin = publicConfig.appUrl ?? window.location.origin;
      const challenge = await post<{ address: string; chainId: number; nonce: string; message: string }>(
        '/api/v1/auth/wallet/challenge',
        { address: wallet.address, chainId: 42220, origin },
      );
      const signature = await signMessageAsync({ message: challenge.message });
      const verified = await post<{ token: string }>(
        '/api/v1/auth/wallet/verify',
        { address: wallet.address, chainId: challenge.chainId, origin, nonce: challenge.nonce, signature },
      );
      setToken(verified.token);
    } catch (error) {
      setResult({ status: 'rejected', reason: error instanceof Error ? error.message : 'Wallet authentication failed.' });
    } finally { setBusy(false); }
  }

  async function start() {
    if (!token) return;
    setBusy(true); setResult(null); setInputs([]);
    try {
      const created = await post<Session>('/api/v1/gameplay/rounds', { gameMode: verifiedFruitSliceGameMode, rulesVersion: verifiedFruitSliceRulesVersion }, token);
      setSession(created); setStartedAt(Date.now());
    } catch (error) {
      setResult({ status: 'rejected', reason: error instanceof Error ? error.message : 'The verified round could not start.' });
    } finally { setBusy(false); }
  }

  function coordinate(event: React.PointerEvent): { x: number; y: number } | null {
    const bounds = board.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  }

  function down(event: React.PointerEvent) {
    if (!session || result) return;
    const next = coordinate(event); if (!next) return;
    setPoint(next); setInputs(current => [...current, { kind: 'pointer', phase: 'down', elapsedMs: elapsed(), ...next }]);
  }

  function up(event: React.PointerEvent) {
    if (!session || !point || result) return;
    const next = coordinate(event) ?? point;
    setInputs(current => [...current, { kind: 'pointer', phase: 'up', elapsedMs: elapsed(), ...next }]);
    setPoint(null);
  }

  async function finish() {
    if (!session || !token) return;
    setBusy(true);
    try {
      const replay = inputs;
      const score = simulateVerifiedFruitSlice(session.seed, replay).score;
      const verified = await post<Result>(`/api/v1/gameplay/rounds/${session.id}/finish`, {
        inputDigest: await digestReplayInputs(replay), score, replayInputs: replay,
      }, token);
      setResult(verified); setSession(null); setStartedAt(null);
    } catch (error) {
      setResult({ status: 'rejected', reason: error instanceof Error ? error.message : 'The verified score could not be submitted.' });
    } finally { setBusy(false); }
  }

  if (!wallet.address) return null;
  return <section className="admin-panel" aria-label="Verified Slyyce mode">
    <p className="eyebrow">VERIFIED MODE</p>
    <h2>Fruit Slice · server checked</h2>
    {!token && <><p>Sign one short-lived wallet challenge to enter the verified leaderboard.</p><button className="button" disabled={busy} onClick={() => void enable()}>{busy ? 'Signing…' : 'Enable verified mode'}</button></>}
    {token && !session && <><p>Practice scores stay local. Verified rounds use deterministic replay validation.</p><button className="button" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start verified round'}</button></>}
    {session && <><div ref={board} className="chopping-board" onPointerDown={down} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', minHeight: 280, touchAction: 'none' }}>
      {targets.filter(target => target.spawnedAt <= elapsed() && elapsed() <= target.spawnedAt + 900).map((target, index) => <span key={index} aria-hidden="true" style={{ position: 'absolute', left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: 32, height: 32, borderRadius: '50%', transform: 'translate(-50%, -50%)', background: target.bomb ? '#e5383b' : '#ffb627', boxShadow: '0 0 18px currentColor' }} />)}
      <span className="board-center"><strong>{Math.max(0, Math.ceil((30_000 - elapsed()) / 1000))}s</strong><small>Swipe across the targets</small></span>
    </div><button className="button" disabled={busy} onClick={() => void finish()}>{busy ? 'Checking replay…' : 'Submit verified score'}</button></>}
    {result && <p role="status">{result.status === 'verified' ? `Verified score: ${result.score ?? 0}` : result.reason}</p>}
  </section>;
}
