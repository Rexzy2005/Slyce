'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { useWallet } from '../web3/context';
/** Best score per player from games saved on Celo, served by the backend's chain index (ADR-0012). */
type Period = 'today' | 'week' | 'all';
interface Entry { rank: number; address: string; score: number; games: number; verified: boolean | null }
const periods: { value: Period; label: string }[] = [{ value: 'today', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }];
const medals = ['🥇', '🥈', '🥉'];
async function loadBoard(period: Period, signal: AbortSignal): Promise<Entry[]> {
  if (!publicConfig.backendUrl) throw new Error('The leaderboard is not available right now.');
  const response = await apiFetch(`${publicConfig.backendUrl}/api/v1/chain/leaderboard?period=${period}`, { signal });
  if (!response.ok) throw new Error('The leaderboard could not be loaded.');
  return (await response.json() as { data: Entry[] }).data;
}
export function Leaderboard() {
  const wallet = useWallet();
  const me = wallet.address?.toLowerCase();
  const [period, setPeriod] = useState<Period>('all');
  const query = useQuery({ queryKey: ['chain-leaderboard', period], queryFn: ({ signal }) => loadBoard(period, signal), refetchInterval: 30_000 });
  return <section className="panel"><div className="segmented" aria-label="Leaderboard period">{periods.map(item => <button key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
    {query.isPending ? <p className="loading-state" role="status">Loading…</p>
      : query.isError ? <EmptyState title="The leaderboard is unavailable"><p>{query.error.message}</p><button className="text-button" onClick={() => void query.refetch()}>Try again</button></EmptyState>
      : query.data.length === 0 ? <EmptyState title="No scores yet"><Link className="button" href="/play/arena">Play</Link></EmptyState>
      : <ol className="data-list leaderboard">{query.data.map(entry => <li key={entry.address} className={entry.address === me ? 'is-me' : undefined}>
          <span>{medals[entry.rank - 1] ?? '#' + entry.rank} <Link href={`/player?address=${entry.address}`}>{entry.address === me ? 'You' : `${entry.address.slice(0, 6)}…${entry.address.slice(-4)}`}</Link>{entry.verified && <span title="GoodDollar-verified"> ✓</span>}</span>
          <strong>{entry.score.toLocaleString()}</strong>
        </li>)}</ol>}
  </section>;
}
