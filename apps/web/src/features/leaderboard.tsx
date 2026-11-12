'use client';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { useWallet } from '../web3/context';
/** Best score per player from games saved on Celo, served by the backend's chain index (ADR-0012). */
type Period = 'today' | 'week' | 'all';
interface Entry { rank: number; address: string; nickname?: string | null; score: number; games: number; verified: boolean | null }
const periods: { value: Period; label: string }[] = [{ value: 'today', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }];
const fruits = ['🍉', '🍊', '🍑', '🥝', '🍋', '🍎', '🍇', '🍍'];
async function loadBoard(period: Period, signal: AbortSignal): Promise<Entry[]> {
  if (!publicConfig.backendUrl) throw new Error('The leaderboard is not available right now.');
  const response = await apiFetch(`${publicConfig.backendUrl}/api/v1/chain/leaderboard?period=${period}`, { signal });
  if (!response.ok) throw new Error('The leaderboard could not be loaded.');
  return (await response.json() as { data: Entry[] }).data;
}
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
/** A flat-coloured avatar derived from the address, so every player is recognisable without a profile picture. */
export function avatarFor(address: string): { fruit: string; style: CSSProperties } {
  const a = parseInt(address.slice(2, 8), 16);
  return { fruit: fruits[a % fruits.length]!, style: { background: `hsl(${a % 360} 55% 45%)` } };
}
function Avatar({ address, size }: { address: string; size?: 'large' }) {
  const avatar = avatarFor(address);
  return <span className={size ? 'lb-avatar lb-avatar-large' : 'lb-avatar'} style={avatar.style} aria-hidden="true">{avatar.fruit}</span>;
}
function Name({ entry, me }: { entry: Entry; me: string | undefined }) {
  return <Link href={`/player?address=${entry.address}`} className="lb-name">{entry.nickname ?? (entry.address === me ? 'You' : short(entry.address))}{entry.verified && <span className="lb-verified" title="GoodDollar-verified">✓</span>}</Link>;
}
function Podium({ top, me }: { top: Entry[]; me: string | undefined }) {
  // Displayed 2nd, 1st, 3rd so the winner stands in the middle.
  const places = [top[1], top[0], top[2]];
  return <div className="lb-podium">{places.map((entry, index) => {
    if (!entry) return <div key={index} className="lb-place lb-empty" />;
    return <div key={entry.address} className={`lb-place lb-place-${entry.rank}${entry.address === me ? ' is-me' : ''}`}>
      {entry.rank === 1 && <span className="lb-crown" aria-hidden="true">👑</span>}
      <Avatar address={entry.address} size="large" />
      <Name entry={entry} me={me} />
      <strong className="lb-score">{entry.score.toLocaleString()}</strong>
      <div className="lb-step"><span>{entry.rank}</span></div>
    </div>;
  })}</div>;
}
export function Leaderboard() {
  const wallet = useWallet();
  const me = wallet.address?.toLowerCase();
  const [period, setPeriod] = useState<Period>('all');
  const query = useQuery({ queryKey: ['chain-leaderboard', period], queryFn: ({ signal }) => loadBoard(period, signal), refetchInterval: 30_000 });
  const mine = query.data?.find(entry => entry.address === me);
  return <section className="panel lb">
    <div className="segmented" aria-label="Leaderboard period">{periods.map(item => <button key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
    {query.isPending ? <p className="loading-state" role="status">Loading…</p>
      : query.isError ? <EmptyState title="The leaderboard is unavailable"><p>{query.error.message}</p><button className="text-button" onClick={() => void query.refetch()}>Try again</button></EmptyState>
      : query.data.length === 0 ? <EmptyState icon="trophy" title="No scores yet"><Link className="button" href="/play/arena">Play</Link></EmptyState>
      : <>
        {me && <div className="lb-you">{mine
          ? <><Avatar address={mine.address} /><span>Your rank</span><strong>#{mine.rank}</strong>{!mine.nickname && <Link href="/profile" className="lb-you-link">Set a nickname</Link>}<span className="lb-you-score">{mine.score.toLocaleString()}</span></>
          : <><span>You're not on the board yet</span><Link className="button" href="/play/arena">Play</Link></>}</div>}
        <Podium top={query.data.slice(0, 3)} me={me} />
        {query.data.length > 3 && <ol className="lb-list" start={4}>{query.data.slice(3).map(entry => <li key={entry.address} className={entry.address === me ? 'is-me' : undefined}>
          <span className="lb-rank">{entry.rank}</span><Avatar address={entry.address} />
          <span className="lb-who"><Name entry={entry} me={me} /><small>{entry.games} {entry.games === 1 ? 'game' : 'games'}</small></span>
          <strong className="lb-score">{entry.score.toLocaleString()}</strong>
        </li>)}</ol>}
      </>}
  </section>;
}
