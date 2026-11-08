'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../web3/context';
import { createTicketQueue, type RoundTicket } from './score-tickets';
import { useShopItems } from '../features/shop';
import { readEquippedBlade } from '../features/catalog';
import { GameHost, type GameResult } from './game-host';
import { RecordGame } from './record-game';
import { TournamentSubmit } from './tournament-submit';
/**
 * Signed-in arena: free to play. Each finished round can be saved on Celo (SlyceArcade v2) for XP and,
 * for GoodDollar-verified humans, milestone G$. An equipped blade is applied only if the shop confirms ownership.
 */
export function ArenaSession() {
  const wallet = useWallet();
  return <>{wallet.live ? <LiveHost /> : wallet.status === 'unavailable' ? <GameHost /> : null}</>;
}
function LiveHost() {
  const wallet = useWallet();
  const { items } = useShopItems();
  const [equipped, setEquipped] = useState<bigint | null>(null);
  useEffect(() => setEquipped(readEquippedBlade()), []);
  const blade = items.find(item => item.id === equipped && item.owned)?.colors;
  // Each round claims a score ticket (ADR-0015); the game-over panels use the ticket of the round that just ended.
  const tickets = useMemo(() => wallet.address ? createTicketQueue(wallet.address) : null, [wallet.address]);
  useEffect(() => { tickets?.prefetch(); }, [tickets]);
  const roundTicket = useRef<Promise<RoundTicket | null> | null>(null);
  const afterGame = (result: GameResult) => <><RecordGame result={result} ticket={roundTicket.current} /><TournamentSubmit result={result} ticket={roundTicket.current} /></>;
  return <GameHost afterGame={afterGame} onRoundStart={() => { roundTicket.current = tickets?.take() ?? null; }} {...(blade ? { blade } : {})} />;
}
