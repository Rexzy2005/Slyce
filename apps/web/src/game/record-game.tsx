'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { arcadeAbi } from '../web3/abis';
import { gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { useContractWrite } from '../web3/use-contract-write';
import { TransactionStatus } from '../components/transaction-status';
import type { GameResult } from './game-host';
import { liveStreak, newMilestones, useGameRecords } from './game-records';
const g = (value: bigint) => formatTokenAmount(value, gdDecimals);
/**
 * Game-over panel: saves the round on Celo (XP, best score, streak) and pays milestone G$ to verified humans.
 * Saving starts automatically once per game; the button stays for retries after a failure or a declined prompt.
 */
export function RecordGame({ result }: { result: GameResult }) {
  const account = useAccount();
  const wallet = useWallet();
  const records = useGameRecords(account.address);
  const write = useContractWrite();
  const [saved, setSaved] = useState<{ xp: bigint; earned: bigint; streak: number } | null>(null);
  const autoSaved = useRef<GameResult | null>(null);
  const canSave = !!records.arcade && !records.loading && records.open && write.ready && write.state.status === 'idle' && !saved;
  useEffect(() => {
    if (!canSave || autoSaved.current === result) return;
    autoSaved.current = result;
    save();
  });
  if (!records.arcade || records.loading) return <p className="muted" role="status">One moment…</p>;
  if (!records.open) return <p className="muted">Saving scores opens soon.</p>;
  const score = Math.min(result.score, records.maxScore);
  const xp = BigInt(Math.floor(score / 10));
  const pending = newMilestones(records.milestones, score, records.rewardedMask);
  const reward = pending.reduce((sum, m) => sum + m.reward, 0n);
  const next = records.milestones.find(m => score < m.score);
  // An empty pot means G$ rewards have not started; the contract then skips milestones without marking them earned.
  const rewardsLive = records.budget !== undefined && records.budget > 0n;
  // The streak the contract will record for this save (computed before the save, from today's stats).
  const streakAfter = liveStreak(records.stats).next;
  // Mirrors the contract: each milestone is paid only if the remaining pot covers it.
  let remaining = records.budget ?? 0n;
  const payable = pending.reduce((sum, m) => m.reward <= remaining ? (remaining -= m.reward, sum + m.reward) : sum, 0n);
  function save() {
    void write.execute(
      { address: records.arcade!, abi: arcadeAbi, functionName: 'submitGame', args: [score, result.bestCombo, result.fruits] },
      { onConfirmed: async () => {
        await records.refetch();
        wallet.refreshBalance?.();
        setSaved({ xp, earned: records.verified ? payable : 0n, streak: streakAfter });
      } },
    );
  }
  if (saved) return <div className="record-game saved" role="status">
    <p><strong className="leaf">Score saved.</strong> +{saved.xp.toString()} XP{saved.earned > 0n ? <> · <strong className="leaf">+{g(saved.earned)} G$</strong> added to your balance</> : null}</p>
    <p className="muted">🔥 {saved.streak}-day streak. Save a score tomorrow to keep it going.</p>
    <Link className="text-button" href="/profile">View your profile →</Link>
  </div>;
  return <div className="record-game">
    <p><strong>Saving your score</strong> for +{xp.toString()} XP{records.verified && payable > 0n ? <> and <strong className="leaf">{g(payable)} G$</strong></> : null}.</p>
    {!rewardsLive && records.budget !== undefined && <p className="muted">G$ rewards haven't started yet. Your XP, best score and streak still count.</p>}
    {rewardsLive && records.verified === false && pending.length > 0 && <p className="muted">This score hits a G$ milestone. <Link href="/get-gd">Verify with GoodDollar</Link> to earn {g(reward)} G$ for it.</p>}
    {rewardsLive && records.verified && payable < reward && <p className="muted">The reward pot is running low, so milestones it can't cover aren't paid for this game.</p>}
    {rewardsLive && next && <p className="muted fine-print">Next milestone: {next.score.toLocaleString()} points → {g(next.reward)} G$.</p>}
    {['failed', 'rejected'].includes(write.state.status) && <button className="button" disabled={!write.ready} onClick={save}>Try saving again</button>}
    {write.state.status !== 'idle' && write.state.status !== 'success' && <TransactionStatus state={write.state} />}
  </div>;
}
