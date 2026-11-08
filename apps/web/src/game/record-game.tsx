'use client';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { arcadeAbi } from '../web3/abis';
import { gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { useContractWrite } from '../web3/use-contract-write';
import type { GameResult } from './game-host';
import { liveStreak, newMilestones, useGameRecords } from './game-records';
import { signRound, useScoreSigning, type RoundTicket } from './score-tickets';
const g = (value: bigint) => formatTokenAmount(value, gdDecimals);
/**
 * Game-over line: saves the round on Celo (XP, best score, streak) and pays milestone G$ to verified humans.
 * Saving is automatic and stays out of the way: it waits out the contract's minimum gap between saves instead of
 * failing, and only shows a button if a save fails or the wallet prompt is declined.
 * Once the Arcade requires signed scores, the backend checks the round's ticket first (ADR-0015).
 */
export function RecordGame({ result, ticket }: { result: GameResult; ticket?: Promise<RoundTicket | null> | null }) {
  const account = useAccount();
  const wallet = useWallet();
  const records = useGameRecords(account.address);
  const write = useContractWrite();
  const signing = useScoreSigning(records.arcade);
  const [saved, setSaved] = useState<{ xp: bigint; earned: bigint; streak: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoSaved = useRef<GameResult | null>(null);
  const canSave = !!records.arcade && !records.loading && records.open && signing !== undefined && write.ready && write.state.status === 'idle' && !busy && !problem && !saved;
  useEffect(() => {
    if (!canSave || autoSaved.current === result) return;
    autoSaved.current = result;
    void save();
  });
  if (!records.arcade || records.loading || !records.open) return null;
  const score = Math.min(result.score, records.maxScore);
  const xp = BigInt(Math.floor(score / 10));
  const pending = newMilestones(records.milestones, score, records.rewardedMask);
  // The streak the contract will record for this save (computed before the save, from today's stats).
  const streakAfter = liveStreak(records.stats).next;
  // Mirrors the contract: each milestone is paid only if the remaining pot covers it.
  let remaining = records.budget ?? 0n;
  const payable = pending.reduce((sum, m) => m.reward <= remaining ? (remaining -= m.reward, sum + m.reward) : sum, 0n);
  const onConfirmed = async () => {
    await records.refetch();
    wallet.refreshBalance?.();
    setSaved({ xp, earned: records.verified ? payable : 0n, streak: streakAfter });
  };
  async function save() {
    setProblem(null); setBusy(true);
    try {
      // The contract refuses a save sooner than `minInterval` after the last one (TooSoon); wait it out.
      const allowedAt = ((records.stats?.lastSubmit ?? 0) + records.minInterval) * 1000 + 1_500;
      if (records.stats?.games && allowedAt > Date.now()) await new Promise(resolve => setTimeout(resolve, allowedAt - Date.now()));
      if (!signing) {
        void write.execute({ address: records.arcade!, abi: arcadeAbi, functionName: 'submitGame', args: [score, result.bestCombo, result.fruits] }, { onConfirmed });
        return;
      }
      const roundTicket = await ticket;
      if (!roundTicket || !account.address) throw new Error('This round couldn\'t be checked.');
      const signed = await signRound(account.address, roundTicket, { score, bestCombo: result.bestCombo, fruits: result.fruits });
      void write.execute({ address: records.arcade!, abi: arcadeAbi, functionName: 'submitSignedGame', args: [score, result.bestCombo, result.fruits, signed.ticket, signed.deadline, signed.gameSignature] }, { onConfirmed });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'This score couldn\'t be checked.');
    } finally { setBusy(false); }
  }
  if (saved) return <p className="record-game saved" role="status">
    <strong className="leaf">Score saved</strong> · +{saved.xp.toString()} XP{saved.earned > 0n ? <> · <strong className="leaf">+{g(saved.earned)} G$</strong></> : null} · 🔥 {saved.streak}-day streak
  </p>;
  const failed = problem !== null || ['failed', 'rejected'].includes(write.state.status);
  if (failed) return <p className="record-game" role="status">
    <span className="muted">Score not saved.</span>{' '}
    <button className="text-button" disabled={!write.ready} onClick={() => void save()}>Save score</button>
  </p>;
  return <p className="record-game muted" role="status">{write.state.status === 'awaiting_wallet' ? 'Confirm in your wallet to save your score…' : 'Saving your score…'}</p>;
}
