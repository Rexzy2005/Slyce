'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/ui';
import { Icon } from '../components/icon';
import { PlayerCard } from '../game/player-card';
import { readBestScore } from '../game/best-score';
import { difficulties } from '../game/preview-settings';
import { useExtraLives } from '../game/score-tickets';
import { InstallButton } from '../pwa/install-button';
import { useWallet } from '../web3/context';
import { WalletPanel } from '../web3/wallet-panel';
import { NicknameEditor } from './nickname';
import { categoryLabels, itemPreview, readEquipped, writeEquipped, type ItemCategory } from './catalog';
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
        <span className={styles.featureMark}><Icon name="wallet" size={25} /></span>
        <div><p className="eyebrow">PLAYER ACCOUNT</p><h2>Arcade wallet</h2></div>
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
        <Link className={styles.recordLink} href={'/player?address=' + wallet.address}>Share profile <Icon name="arrow" size={15} /></Link>
      </div>
      <PlayerCard player={wallet.address} />
    </section>}
  </div>;
}

function Collection() {
  const { items, reads } = useShopItems();
  const wallet = useWallet();
  const lives = useExtraLives(wallet.address);
  const dialog = useRef<HTMLDialogElement>(null);
  const [equipped, setEquipped] = useState<Record<ItemCategory, bigint | null>>({ blade: null, fruit: null, board: null });
  useEffect(() => setEquipped({ blade: readEquipped('blade'), fruit: readEquipped('fruit'), board: readEquipped('board') }), []);
  const owned = items.filter(item => item.owned && (item.category !== 'lives' || (lives.available ?? 0) > 0));
  function equip(category: ItemCategory, id: bigint | null) {
    writeEquipped(category, id);
    setEquipped(current => ({ ...current, [category]: id }));
  }

  return <>
    <section className={`panel ${styles.panel} ${styles.collectionPanel}`}>
      <div className={styles.loadoutHeading}><SectionHeading eyebrow="YOUR LOADOUT · ON-CHAIN" title="The gear you carry" /><span className={styles.loadoutCount}>{reads.isPending ? '…' : owned.length} items</span></div>
      {reads.isPending
        ? <p className={styles.collectionMessage} role="status">Loading your collection…</p>
        : owned.length
          ? <div className={styles.loadoutShelf}>{owned.slice(0, 3).map(item => <span key={item.id.toString()} className={styles.loadoutPreview} style={{ background: itemPreview(item) }} title={item.name} />)}{owned.length > 3 && <span className={styles.loadoutMore}>+{owned.length - 3}</span>}</div>
          : <p className={styles.collectionMessage}>Your next favorite look is waiting in the market.</p>}
      <button className={styles.openLoadout} type="button" disabled={reads.isPending} onClick={() => dialog.current?.showModal()}><Icon name="bag" size={17} /> View loadout <Icon name="arrow" size={15} /></button>
    </section>

    <dialog ref={dialog} className={styles.loadoutDialog} aria-labelledby="loadout-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.loadoutModal}>
        <header className={styles.loadoutModalHeading}>
          <div><p className="eyebrow">YOUR ARCADE KIT</p><h2 id="loadout-title">Loadout</h2><p>Pick the look you want to bring into your next round.</p></div>
          <button type="button" className={styles.closeLoadout} aria-label="Close loadout" onClick={() => dialog.current?.close()}><Icon name="close" size={19} /></button>
        </header>
        {owned.length
          ? <ul className={styles.loadoutItems}>{owned.map(item => {
              const itemEquipped = item.category !== 'lives' && equipped[item.category] === item.id;
              return <li key={item.id.toString()} className={styles.loadoutItem}>
                <span className={`${styles.loadoutItemArt} ${item.category === 'blade' ? styles.loadoutBlade : item.category === 'fruit' ? styles.loadoutFruit : item.category === 'board' ? styles.loadoutBoard : styles.loadoutLives}`} style={{ background: itemPreview(item) }} aria-hidden="true"><Icon name={item.category === 'blade' ? 'scissors' : item.category === 'fruit' ? 'leaf' : item.category === 'board' ? 'layers' : 'heart'} size={20} /></span>
                <span className={styles.loadoutItemCopy}><strong>{item.name}</strong><small>{categoryLabels[item.category]}{item.category === 'lives' ? ` · ${lives.available ?? 0} available` : ''}</small></span>
                {item.category !== 'lives' && <button className={styles.loadoutEquip} type="button" aria-pressed={itemEquipped} onClick={() => equip(item.category, itemEquipped ? null : item.id)}>{itemEquipped ? 'Equipped' : 'Equip'}</button>}
              </li>;
            })}</ul>
          : <div className={styles.loadoutEmpty}><Icon name="sparkles" size={25} /><h3>Make it yours</h3><p>Unlock a blade trail, fruit skin, or board to build your first loadout.</p></div>}
        <footer className={styles.loadoutModalFooter}><Link href="/shop" onClick={() => dialog.current?.close()}>Explore the market <Icon name="arrow" size={16} /></Link><span>Cosmetics change your look, never your score.</span></footer>
      </div>
    </dialog>
  </>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className={styles.sectionHeading}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>;
}
