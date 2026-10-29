'use client';
import { useReadContract } from 'wagmi';
import { publicConfig } from '../config/public';
import { arcadeAbi } from '../web3/abis';
import { chainFor, contractsFor, gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import Link from 'next/link';
import { formatTokenAmount } from '../web3/units';
import { usePrizePool } from './prize-pool';
export function PlayFeeLabel() {
  const wallet = useWallet();
  return wallet.live ? <Fee /> : null;
}
function Fee() {
  const arcade = contractsFor(publicConfig).arcade;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const fee = useReadContract({ address: arcade, abi: arcadeAbi, functionName: 'playFee', chainId: chain?.id, query: { enabled: !!arcade && !!chain } });
  const prize = usePrizePool();
  if (!arcade || fee.data === undefined) return null;
  return <>
    {prize.id !== undefined && prize.pool !== undefined && <Link href="/tournament" className="home-prize"><span>BOUNTY PRIZE POOL</span><strong>{Number(formatTokenAmount(prize.pool, gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} G$</strong><small>Verified players compete for it →</small></Link>}
    <small className="home-fee">{fee.data === 0n ? 'Free to play · save games on Celo for XP and G$ milestones' : formatTokenAmount(fee.data, gdDecimals) + ' G$ per round'} · <Link href="/how-to-play">How to play</Link></small>
  </>;
}
