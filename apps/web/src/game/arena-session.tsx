'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../web3/context';
import { createTicketQueue, type RoundTicket } from './score-tickets';
import { useShopItems } from '../features/shop';
import { readEquipped, type CatalogItem, type ItemCategory } from '../features/catalog';
import { GameHost, type GameResult } from './game-host';
import { RecordGame } from './record-game';
import { TournamentSubmit } from './tournament-submit';
/**
 * Signed-in arena: free to play. Each finished round can be saved on Celo (SlyceArcade v2) for XP and,
 * for GoodDollar-verified humans, milestone G$. Equipped shop cosmetics apply only if the shop confirms ownership.
 */
export function ArenaSession() {
  const wallet = useWallet();
  return <>{wallet.live ? <LiveHost /> : wallet.status === 'unavailable' ? <GameHost /> : null}</>;
}
function LiveHost() {
  const wallet = useWallet();
  const { items } = useShopItems();
  const [equipped, setEquipped] = useState<Record<ItemCategory, bigint | null>>({ blade: null, fruit: null, board: null });
  useEffect(() => setEquipped({ blade: readEquipped('blade'), fruit: readEquipped('fruit'), board: readEquipped('board') }), []);
  // Equipped items apply only if the shop confirms ownership on-chain.
  const owned = (category: ItemCategory): CatalogItem | undefined => items.find(item => item.category === category && item.id === equipped[category] && item.owned);
  const bladeItem = owned('blade'), fruitItem = owned('fruit'), boardItem = owned('board');
  const blade = bladeItem?.category === 'blade' ? bladeItem.look : undefined;
  const fruitSkin = fruitItem?.category === 'fruit' ? fruitItem.look : undefined;
  const board = boardItem?.category === 'board' ? boardItem.look : undefined;
  // Each round claims a score ticket (ADR-0015); the game-over panels use the ticket of the round that just ended.
  const tickets = useMemo(() => wallet.address ? createTicketQueue(wallet.address) : null, [wallet.address]);
  useEffect(() => { tickets?.prefetch(); }, [tickets]);
  const roundTicket = useRef<Promise<RoundTicket | null> | null>(null);
  const afterGame = (result: GameResult) => <><RecordGame result={result} ticket={roundTicket.current} /><TournamentSubmit result={result} ticket={roundTicket.current} /></>;
  return <GameHost afterGame={afterGame} onRoundStart={() => { roundTicket.current = tickets?.take() ?? null; }} {...(blade ? { blade } : {})} {...(fruitSkin ? { fruitSkin } : {})} {...(board ? { board } : {})} />;
}
