'use client';
import { useEffect, useState } from 'react';
import { useWallet } from '../web3/context';
import { useShopItems } from '../features/shop';
import { readEquippedBlade } from '../features/catalog';
import { GameHost, type GameResult } from './game-host';
import { RecordGame } from './record-game';
import { VerifiedMode } from './verified-mode';
const afterGame = (result: GameResult) => <RecordGame result={result} />;
/**
 * Signed-in arena: free to play. Each finished round can be saved on Celo (SlyceArcade v2) for XP and,
 * for GoodDollar-verified humans, milestone G$. An equipped blade is applied only if the shop confirms ownership.
 */
export function ArenaSession() {
  const wallet = useWallet();
  return <>{wallet.live ? <LiveHost /> : wallet.status === 'unavailable' ? <GameHost /> : null}<VerifiedMode /></>;
}
function LiveHost() {
  const { items } = useShopItems();
  const [equipped, setEquipped] = useState<bigint | null>(null);
  useEffect(() => setEquipped(readEquippedBlade()), []);
  const blade = items.find(item => item.id === equipped && item.owned)?.colors;
  return <GameHost afterGame={afterGame} {...(blade ? { blade } : {})} />;
}
