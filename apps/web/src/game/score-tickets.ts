'use client';
import { useCallback, useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { zeroAddress } from 'viem';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { arcadeAbi } from '../web3/abis';
import { chainFor } from '../web3/config';

/**
 * Signed scores (ADR-0015). A ticket is fetched before each round; when the round ends the backend signs the
 * result if it is believable for the time since the ticket was issued. The contracts accept each ticket once.
 */
export interface RoundTicket { token: string; ticket: string; issuedAt: number }
export interface SignedRound { ticket: bigint; deadline: bigint; gameSignature: `0x${string}`; tournamentSignature?: `0x${string}` }
export class ScoreNotVerified extends Error {}

/** Tickets older than this are replaced when a round starts, so the round's ticket is recent (the backend accepts 2 hours). */
const freshForMs = 3 * 60_000;

async function post<T>(path: string, body?: unknown): Promise<T> {
  if (!publicConfig.backendUrl) throw new ScoreNotVerified('Score checks are not available right now.');
  const response = await apiFetch(`${publicConfig.backendUrl}/api/v1${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json().catch(() => ({})) as { data?: T; error?: { code?: string; message?: string } };
  if (response.status === 422) throw new ScoreNotVerified(value.error?.message ?? 'This score could not be verified.');
  if (!response.ok || !value.data) throw new Error(value.error?.message ?? 'The score check is unavailable. Try again.');
  return value.data;
}

export async function requestTicket(address: string): Promise<RoundTicket> {
  const data = await post<{ token: string; ticket: string; issuedAt: string }>('/score-tickets', { address });
  return { token: data.token, ticket: data.ticket, issuedAt: Date.parse(data.issuedAt) };
}

export async function signRound(address: string, ticket: RoundTicket, result: { score: number; bestCombo: number; fruits: number }, tournamentId?: bigint): Promise<SignedRound> {
  const data = await post<{ ticket: string; deadline: number; gameSignature: `0x${string}`; tournamentSignature?: `0x${string}` }>('/score-tickets/finish', {
    address, token: ticket.token, score: result.score, bestCombo: result.bestCombo, fruits: result.fruits,
    ...(tournamentId !== undefined ? { tournamentId: tournamentId.toString() } : {}),
  });
  return { ticket: BigInt(data.ticket), deadline: BigInt(data.deadline), gameSignature: data.gameSignature, ...(data.tournamentSignature ? { tournamentSignature: data.tournamentSignature } : {}) };
}

/**
 * Keeps one ticket ready for the next round, so starting a round never waits on the network (a sleeping
 * backend can take a while to wake). `take()` hands the ready ticket to the round that is starting and
 * fetches a fresh one for the round after.
 */
export function createTicketQueue(address: string, request = requestTicket, now = Date.now) {
  let next: Promise<RoundTicket | null> | null = null;
  const fetchNext = () => { next = request(address).catch(() => null); return next; };
  return {
    prefetch() { if (!next) void fetchNext(); },
    async take(): Promise<RoundTicket | null> {
      const ready = await (next ?? fetchNext());
      void fetchNext();
      if (ready && now() - ready.issuedAt < freshForMs) return ready;
      return request(address).catch(() => null);
    },
  };
}

/**
 * Whether a contract requires backend-signed scores: true once its owner sets a score signer, false before
 * that (or on a version without signed scores), undefined while loading. Arcade and Tournament share the
 * `scoreSigner()` view from SlyceBase.
 */
export function useScoreSigning(contract: `0x${string}` | undefined): boolean | undefined {
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const read = useReadContract({ address: contract, abi: arcadeAbi, functionName: 'scoreSigner', ...(chain ? { chainId: chain.id } : {}), query: { enabled: !!contract } });
  if (read.isError) return false;
  return read.data === undefined ? undefined : read.data !== zeroAddress;
}

/** Extra lives (ADR-0016): owned packs are read on-chain by the backend, which also records each life used. */
export interface ExtraLives { owned: number; used: number; available: number }
export const extraLivesBalance = (address: string) => post<ExtraLives>(`/extra-lives?address=${address}`);
export const spendExtraLife = (address: string, ticket: RoundTicket) => post<ExtraLives>('/extra-lives/use', { address, token: ticket.token });

/** A player's extra lives; `available` is undefined until loaded (or when the backend can't be reached). */
export function useExtraLives(address: string | undefined) {
  const [balance, setBalance] = useState<ExtraLives>();
  const refresh = useCallback(async () => {
    if (!address) return undefined;
    try { const next = await extraLivesBalance(address); setBalance(next); return next; } catch { return undefined; }
  }, [address]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { available: balance?.available, refresh, set: setBalance };
}
