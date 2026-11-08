'use client';
import { useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { tournamentAbi } from '../web3/abis';
import { chainFor, contractsFor } from '../web3/config';
import { refetchUntil } from '../web3/receipt';
import { useContractWrite } from '../web3/use-contract-write';
import type { GameResult } from './game-host';
import { signRound, useScoreSigning, type RoundTicket } from './score-tickets';

type Details = { startTime: bigint; endTime: bigint; cancelled: boolean };
/**
 * Game-over shortcut into the open prize tournament: submit this round's score in one tap instead of going back
 * to the Compete page (which only knows this device's stored best). Tournament scores count on Normal only.
 */
export function TournamentSubmit({ result, ticket }: { result: GameResult; ticket?: Promise<RoundTicket | null> | null }) {
  const account = useAccount();
  const { tournament } = contractsFor(publicConfig);
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const open = useReadContracts({ contracts: tournament && chain ? [{ address: tournament, abi: tournamentAbi, functionName: 'openPrizeTournament', chainId: chain.id }] as const : [], query: { enabled: !!tournament && !!chain } });
  const id = open.data?.[0]?.result as bigint | undefined;
  const reads = useReadContracts({
    contracts: tournament && chain && id && account.address ? [
      { address: tournament, abi: tournamentAbi, functionName: 'getTournament', args: [id], chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'entered', args: [id, account.address], chainId: chain.id },
      { address: tournament, abi: tournamentAbi, functionName: 'bestScore', args: [id, account.address], chainId: chain.id },
    ] as const : [],
    query: { enabled: !!tournament && !!chain && !!id && !!account.address },
  });
  const submit = useContractWrite();
  const signing = useScoreSigning(tournament);
  const [sent, setSent] = useState(false);
  const [check, setCheck] = useState<{ status: 'checking' } | { status: 'failed'; message: string } | null>(null);
  if (!tournament || !id || !reads.data || signing === undefined) return null;
  const [detailsRaw, enteredRaw, bestRaw] = reads.data.map(entry => entry.result);
  const details = detailsRaw as Details | undefined;
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (!details || details.cancelled || now < details.startTime || now >= details.endTime) return null;
  const entered = enteredRaw === true;
  const best = typeof bestRaw === 'number' ? bestRaw : 0;
  // Only offer a submit when it would count; otherwise stay quiet so the game-over screen stays clean.
  if (sent) return <p className="muted fine-print"><strong className="leaf">Sent to tournament #{id.toString()}.</strong></p>;
  if (!entered || result.difficulty !== 'normal' || result.score <= best) return null;
  const onConfirmed = async () => { setSent(true); await refetchUntil(reads.refetch, data => Number(data?.[2]?.result ?? 0) >= result.score); };
  async function send(tournamentId: bigint) {
    if (!signing) {
      void submit.execute({ address: tournament!, abi: tournamentAbi, functionName: 'submitScore', args: [tournamentId, result.score] }, { onConfirmed });
      return;
    }
    // Signed scores (ADR-0015): the backend checks this round's ticket and signs the score for this tournament.
    setCheck({ status: 'checking' });
    try {
      const roundTicket = await ticket;
      if (!roundTicket || !account.address) throw new Error('This round couldn\'t be checked. Check your connection, then play another round.');
      const signed = await signRound(account.address, roundTicket, { score: result.score, bestCombo: result.bestCombo, fruits: result.fruits }, tournamentId);
      if (!signed.tournamentSignature) throw new Error('Tournament scores can\'t be checked right now.');
      setCheck(null);
      void submit.execute({ address: tournament!, abi: tournamentAbi, functionName: 'submitSignedScore', args: [tournamentId, result.score, signed.ticket, signed.deadline, signed.tournamentSignature] }, { onConfirmed });
    } catch (error) {
      setCheck({ status: 'failed', message: error instanceof Error ? error.message : 'This score couldn\'t be checked.' });
    }
  }
  return <div className="tournament-submit">
    <button className="button secondary" disabled={!submit.ready || check?.status === 'checking' || !['idle', 'rejected', 'failed'].includes(submit.state.status)} onClick={() => void send(id)}>Submit {result.score.toLocaleString()} to tournament #{id.toString()}</button>
    {(check?.status === 'checking' || ['preparing', 'awaiting_wallet', 'submitted', 'confirming', 'confirmed', 'synchronizing'].includes(submit.state.status)) && <p className="muted fine-print" role="status">Sending…</p>}
    {(check?.status === 'failed' || ['failed', 'rejected'].includes(submit.state.status)) && <p className="muted fine-print" role="status">Not sent. Tap to try again.</p>}
  </div>;
}
