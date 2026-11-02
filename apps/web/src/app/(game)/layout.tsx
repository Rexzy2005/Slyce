import type { ReactNode } from 'react';
import Link from 'next/link';
import { TabBar } from '../../components/tab-bar';
import { AccountButton } from '../../web3/account-button';
import { BalanceChip } from '../../web3/balance-chip';
import { SignInGate, VerifiedGate } from '../../web3/sign-in-gate';
import { GasBanner } from '../../web3/gas-banner';
import { SignUpRecorder } from '../../web3/sign-up-recorder';
export default function GameLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell"><SignInGate>
    <header className="app-bar"><Link href="/play" className="brand" aria-label="Slyyce home">slyyce<span className="brand-dot">/</span></Link><BalanceChip /><AccountButton /></header>
    <main id="main" tabIndex={-1} className="app-main"><SignUpRecorder /><GasBanner /><VerifiedGate>{children}</VerifiedGate></main>
    <TabBar />
  </SignInGate></div>;
}
