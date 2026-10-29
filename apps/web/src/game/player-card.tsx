'use client';
import type { Address } from 'viem';
import { gdDecimals } from '../web3/config';
import { formatTokenAmount } from '../web3/units';
import { useGameRecords } from './game-records';
/** On-chain stats for one player: XP, best score, games, streak and G$ earned from milestones. */
export function PlayerCard({ player }: { player: Address }) {
  const records = useGameRecords(player);
  const s = records.stats;
  if (records.loading) return <p className="loading-state" role="status">Reading Celo…</p>;
  if (records.error) return <p className="error-text" role="alert">Stats could not be read from Celo.</p>;
  return <dl className="stat-grid player-card">
    <div><dt>XP</dt><dd className="mango">{s ? s.xp.toLocaleString() : '0'}</dd></div>
    <div><dt>Best score</dt><dd>{s ? s.bestScore.toLocaleString() : '—'}</dd></div>
    <div><dt>Games</dt><dd>{s ? s.games.toLocaleString() : '0'}</dd></div>
    <div><dt>Streak</dt><dd>{s && s.streak ? s.streak + (s.streak === 1 ? ' day' : ' days') : '—'}</dd></div>
    <div><dt>G$ earned</dt><dd className="leaf">{s ? Number(formatTokenAmount(s.earned, gdDecimals)).toLocaleString() : '0'}</dd></div>
    <div><dt>GoodDollar</dt><dd>{records.verified ? 'Verified' : records.verified === false ? 'Not verified' : '—'}</dd></div>
  </dl>;
}
