import type { ReactNode } from 'react';
import Link from 'next/link';
import { TabBar } from '../../components/tab-bar';
import { AccountButton } from '../../web3/account-button';
import { BalanceChip } from '../../web3/balance-chip';
import { SignInGate } from '../../web3/sign-in-gate';
import { GasBanner } from '../../web3/gas-banner';
export default function GameLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell"><SignInGate>
    <header className="app-bar"><Link href="/play" className="brand" aria-label="Slyce home">slyce<span className="brand-dot">/</span></Link><BalanceChip /><AccountButton /></header>
    <main id="main" tabIndex={-1} className="app-main"><GasBanner />{children}</main>
    <TabBar />
  </SignInGate></div>;
}
