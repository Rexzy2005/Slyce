'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { arcadeAbi } from '../web3/abis';
import { gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { useContractWrite } from '../web3/use-contract-write';
import { TransactionStatus } from '../components/transaction-status';
import type { GameResult } from './game-host';
import { newMilestones, useGameRecords } from './game-records';
const g = (value: bigint) => formatTokenAmount(value, gdDecimals);
/** Game-over panel: saves the round on Celo (XP, best score, streak) and pays milestone G$ to verified humans. */
export function RecordGame({ result }: { result: GameResult }) {
  const account = useAccount();
  const wallet = useWallet();
  const records = useGameRecords(account.address);
  const write = useContractWrite();
  const [saved, setSaved] = useState<{ xp: bigint; earned: bigint } | null>(null);
  if (!records.arcade || records.loading) return <p className="muted" role="status">Checking Celo…</p>;
  if (!records.open) return <p className="muted">Saving games on Celo opens soon.</p>;
  const score = Math.min(result.score, records.maxScore);
  const xp = BigInt(Math.floor(score / 10));
  const pending = newMilestones(records.milestones, score, records.rewardedMask);
  const reward = pending.reduce((sum, m) => sum + m.reward, 0n);
  const next = records.milestones.find(m => score < m.score);
  if (saved) return <div className="record-game saved" role="status">
    <p><strong className="leaf">Saved on Celo.</strong> +{saved.xp.toString()} XP{saved.earned > 0n ? <> · <strong className="leaf">+{g(saved.earned)} G$</strong> sent to your wallet</> : null}</p>
    <Link className="text-button" href="/profile">View your profile →</Link>
  </div>;
  return <div className="record-game">
    <p><strong>Save this game on Celo</strong> for +{xp.toString()} XP{records.verified && reward > 0n ? <> and <strong className="leaf">{g(reward)} G$</strong></> : null}.</p>
    {records.verified === false && pending.length > 0 && <p className="muted">This score hits a G$ milestone. <Link href="/get-gd">Verify with GoodDollar</Link> to earn {g(reward)} G$ for it.</p>}
    {records.verified && reward > 0n && records.budget !== undefined && records.budget < reward && <p className="muted">The reward pot is running low; some milestones may be paid later.</p>}
    {next && <p className="muted fine-print">Next milestone: {next.score.toLocaleString()} points → {g(next.reward)} G$.</p>}
    <button className="button" disabled={!write.ready || !['idle', 'failed', 'rejected'].includes(write.state.status)} onClick={() => void write.execute(
      { address: records.arcade!, abi: arcadeAbi, functionName: 'submitGame', args: [score, result.bestCombo, result.fruits] },
      { onConfirmed: async () => {
        await records.refetch();
        wallet.refreshBalance?.();
        setSaved({ xp, earned: records.verified ? reward : 0n });
      } },
    )}>Save on Celo</button>
    {write.state.status !== 'idle' && write.state.status !== 'success' && <TransactionStatus state={write.state} />}
  </div>;
}
