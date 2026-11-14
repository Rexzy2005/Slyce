'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '../components/ui';
import { PlayerCard } from '../game/player-card';
import { readBestScore } from '../game/best-score';
import { difficulties } from '../game/preview-settings';
import { InstallButton } from '../pwa/install-button';
import { useWallet } from '../web3/context';
import { WalletPanel } from '../web3/wallet-panel';
import { NicknameEditor } from './nickname';
import { useShopItems } from './shop';
import styles from './profile.module.css';

export function Profile() {
  const wallet = useWallet();
  const [bests, setBests] = useState<(number | null)[]>([]);
  useEffect(() => setBests(difficulties.map(readBestScore)), []);
  const connected = wallet.live && wallet.status === 'connected' && Boolean(wallet.address);

  return <div className={styles.profileCards}>
    <section className={styles.walletCard} aria-label="Account balance">
      <div className={styles.featureHeading}>
        <span className={styles.featureMark} aria-hidden="true">S<span>/</span></span>
        <div><p className="eyebrow">ARCADE WALLET</p><h2>Your balance</h2></div>
      </div>
      <WalletPanel />
    </section>

    {connected && wallet.address && <section className={`panel ${styles.panel} ${styles.nicknamePanel}`}>
      <SectionHeading eyebrow="PLAYER ID" title="Choose your name" />
      <NicknameEditor address={wallet.address} />
    </section>}

    <section className={`panel ${styles.panel} ${styles.installPanel}`}>
      <SectionHeading eyebrow="PLAY ANYWHERE" title="Take Slyyce with you" />
      <p className={styles.sectionCopy}>Add the arcade to your home screen for a quicker way back to the action.</p>
      <InstallButton />
    </section>

    <section className={`panel ${styles.panel} ${styles.practicePanel}`}>
      <SectionHeading eyebrow="LOCAL RECORDS" title="Practice bests" />
      <p className={styles.sectionCopy}>Personal highs saved on this device.</p>
      <dl className={`stat-grid ${styles.practiceStats}`}>
        {difficulties.map((difficulty, index) => <div key={difficulty}><dt>{difficulty}</dt><dd>{bests[index]?.toLocaleString() ?? '—'}</dd></div>)}
      </dl>
    </section>

    {connected
      ? <Collection />
      : <section className={`panel ${styles.panel} ${styles.collectionPanel}`}>
          <SectionHeading eyebrow="YOUR LOADOUT" title="Collection" />
          <EmptyState title="Your collection starts here"><p>Sign in to see the items you own.</p></EmptyState>
        </section>}

    {connected && wallet.address && <section className={`panel ${styles.panel} ${styles.recordCard}`}>
      <div className={styles.recordHeading}>
        <SectionHeading eyebrow="ON-CHAIN PLAYER RECORD" title="Your stats" />
        <Link className={styles.recordLink} href={'/player?address=' + wallet.address}>Share profile <span aria-hidden="true">↗</span></Link>
      </div>
      <PlayerCard player={wallet.address} />
    </section>}
  </div>;
}

function Collection() {
  const { items, reads } = useShopItems();
  const owned = items.filter(item => item.owned);
  return <section className={`panel ${styles.panel} ${styles.collectionPanel}`}>
    <SectionHeading eyebrow="YOUR LOADOUT · ON-CHAIN" title="Collection" />
    {reads.isPending
      ? <p className={styles.collectionMessage} role="status">Loading your collection…</p>
      : owned.length
        ? <ul className="data-list">{owned.map(item => <li key={item.id.toString()}><span>{item.name}<small>{item.description}</small></span></li>)}</ul>
        : <p className={styles.collectionMessage}>No items in your loadout yet. Visit the shop to find your first look.</p>}
  </section>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className={styles.sectionHeading}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>;
}
