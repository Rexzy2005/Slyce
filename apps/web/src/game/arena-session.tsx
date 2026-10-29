'use client';
import { useEffect, useState } from 'react';
import { useWallet } from '../web3/context';
import { useShopItems } from '../features/shop';
import { readEquippedBlade } from '../features/catalog';
import { GameHost } from './game-host';
import { PayToPlay } from './pay-to-play';
import { VerifiedMode } from './verified-mode';
const payGate = (start: () => void) => <PayToPlay onPaid={start} />;
/**
 * Signed-in arena: each round is paid on-chain (SlyceArcade) before it starts, and an equipped blade
 * is applied only after the shop contract confirms the wallet owns it.
 */
export function ArenaSession() {
  const wallet = useWallet();
  return <>{wallet.live ? <PaidHost /> : wallet.status === 'unavailable' ? <GameHost /> : null}<VerifiedMode /></>;
}
function PaidHost() {
  const { items } = useShopItems();
  const [equipped, setEquipped] = useState<bigint | null>(null);
  useEffect(() => setEquipped(readEquippedBlade()), []);
  const blade = items.find(item => item.id === equipped && item.owned)?.colors;
  return <GameHost payGate={payGate} {...(blade ? { blade } : {})} />;
}
