'use client';
import type { Address } from 'viem';
import { gdDecimals } from '../web3/config';
import { formatTokenAmount } from '../web3/units';
import { liveStreak, useGameRecords } from './game-records';
/** On-chain stats for one player: XP, best score, games, streak and G$ earned from milestones. */
export function PlayerCard({ player }: { player: Address }) {
  const records = useGameRecords(player);
  const s = records.stats;
  const streak = liveStreak(s);
  if (records.loading) return <p className="loading-state" role="status">Loading stats…</p>;
  if (records.error) return <p className="error-text" role="alert">Stats couldn't be loaded.</p>;
  return <dl className="stat-grid player-card">
    <div><dt>XP</dt><dd className="mango">{s ? s.xp.toLocaleString() : '0'}</dd></div>
    <div><dt>Best score</dt><dd>{s ? s.bestScore.toLocaleString() : '—'}</dd></div>
    <div><dt>Games</dt><dd>{s ? s.games.toLocaleString() : '0'}</dd></div>
    <div><dt>Daily streak</dt><dd>{streak.current ? streak.current + (streak.current === 1 ? ' day' : ' days') : '0 days'}</dd>{s && s.games > 0 && <small className="muted">{streak.savedToday ? 'Saved today ✓' : 'Save a score today to keep it going'}</small>}</div>
    <div><dt>G$ earned</dt><dd className="leaf">{s ? Number(formatTokenAmount(s.earned, gdDecimals)).toLocaleString() : '0'}</dd></div>
    <div><dt>GoodDollar</dt><dd>{records.verified ? 'Verified' : records.verified === false ? 'Not verified' : '—'}</dd></div>
  </dl>;
}
