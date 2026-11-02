'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './context';
/** New email wallets start with no CELO; GoodDollar's faucet tops up verified users. */
export function GasBanner() {
  const wallet = useWallet();
  const pathname = usePathname();
  if (wallet.status !== 'connected' || wallet.gas !== 'low' || pathname === '/get-gd') return null;
  return <Link href="/get-gd" className="gas-banner" role="status"><strong>One more step before you can save scores.</strong> Get a free account top-up from GoodDollar on the Get G$ tab. →</Link>;
}
