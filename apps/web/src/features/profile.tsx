'use client';
import Link from 'next/link';
import { useWallet } from '../web3/context';
import { PlayerCard } from '../game/player-card';
import { WalletPanel } from '../web3/wallet-panel';
import { EmptyState } from '../components/ui';
import { useShopItems } from './shop';
import { readBestScore } from '../game/best-score';
import { difficulties } from '../game/preview-settings';
import { useEffect, useState } from 'react';
import styles from './profile.module.css';
export function Profile() {
  const wallet = useWallet();
  const [bests, setBests] = useState<(number | null)[]>([]);
  useEffect(() => setBests(difficulties.map(readBestScore)), []);
  const connected = wallet.live && wallet.status === 'connected' && Boolean(wallet.address);
  return <div className={styles.profileCards}>
    <div className={styles.walletCard}><WalletPanel /></div>
    <section className={`panel ${styles.panel}`}><p className="eyebrow">PRACTICE BESTS · THIS DEVICE</p><dl className="stat-grid">{difficulties.map((difficulty, index) => <div key={difficulty}><dt>{difficulty}</dt><dd>{bests[index]?.toLocaleString() ?? '—'}</dd></div>)}</dl></section>
    {connected ? <Collection /> : <section className={`panel ${styles.panel}`}><EmptyState title="Your collection"><p>Connect your wallet to see the blades you own.</p></EmptyState></section>}
    {connected && wallet.address && <section className={`panel ${styles.panel} ${styles.recordCard}`}><p className="eyebrow">YOUR RECORD · ON CELO</p><PlayerCard player={wallet.address} /><p className="muted fine-print">Public profile: <Link href={'/player?address=' + wallet.address}>share your stats</Link></p></section>}
  </div>;
}
function Collection() {
  const { items, reads } = useShopItems();
  const owned = items.filter(item => item.owned);
  return <section className={`panel ${styles.panel}`}><p className="eyebrow">YOUR BLADES · ON-CHAIN</p>{reads.isPending ? <p role="status">Loading…</p> : owned.length ? <ul className="data-list">{owned.map(item => <li key={item.id.toString()}><span>{item.name}<small>{item.description}</small></span></li>)}</ul> : <p className="muted">No blades yet. Visit the market to pick one up.</p>}</section>;
}
