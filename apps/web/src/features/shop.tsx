'use client';
import { useEffect, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { Icon } from '../components/icon';
import { useWallet } from '../web3/context';
import { shopAbi } from '../web3/abis';
import { chainFor, contractsFor, gdDecimals } from '../web3/config';
import { refetchUntil } from '../web3/receipt';
import { TokenSpend } from '../web3/token-spend';
import { formatTokenAmount } from '../web3/units';
import { catalogItems, categoryLabels, itemPreview, readEquipped, writeEquipped, type ItemCategory, type PowerUpCategory } from './catalog';
import { useExtraLives } from '../game/score-tickets';

/** On-chain price, availability and ownership for every catalog item. */
export function useShopItems() {
  const account = useAccount();
  const shop = contractsFor(publicConfig).shop;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const reads = useReadContracts({
    contracts: shop && chain ? catalogItems.flatMap(item => [
      { address: shop, abi: shopAbi, functionName: 'items', args: [item.id], chainId: chain.id } as const,
      { address: shop, abi: shopAbi, functionName: 'purchased', args: [account.address ?? '0x0000000000000000000000000000000000000000', item.id], chainId: chain.id } as const,
    ]) : [],
    query: { enabled: !!shop && !!chain },
  });
  const items = catalogItems.map((item, index) => {
    const listing = reads.data?.[index * 2]?.result as { price: bigint; maxPerWallet: number; active: boolean; exists: boolean } | undefined;
    const owned = account.address ? reads.data?.[index * 2 + 1]?.result as bigint | undefined : 0n;
    return { ...item, price: listing?.exists ? listing.price : undefined, active: !!listing?.exists && listing.active, owned: (owned ?? 0n) > 0n };
  });
  return { shop, items, reads };
}

export function Shop() {
  const wallet = useWallet();
  // Wagmi hooks need the wallet provider, which only mounts when Web3 is configured.
  if (!wallet.live) return <section className="panel"><EmptyState title="The market is getting ready"><p>{wallet.message ?? 'Sign-in is not available right now.'}</p></EmptyState></section>;
  return <Market />;
}

const categories: readonly (ItemCategory | PowerUpCategory)[] = ['lives', 'blade', 'fruit', 'board'];

function Market() {
  const { shop, items, reads } = useShopItems();
  const account = useAccount();
  const lives = useExtraLives(account.address);
  const [equipped, setEquipped] = useState<Record<ItemCategory, bigint | null>>({ blade: null, fruit: null, board: null });
  useEffect(() => setEquipped({ blade: readEquipped('blade'), fruit: readEquipped('fruit'), board: readEquipped('board') }), []);
  function equip(category: ItemCategory, id: bigint | null) { writeEquipped(category, id); setEquipped(current => ({ ...current, [category]: id })); }
  if (!shop) return <section className="panel"><EmptyState title="The market is getting ready"><p>The market isn't open right now. Check back soon.</p></EmptyState></section>;
  if (reads.isPending) return <section className="panel"><p className="loading-state" role="status">Loading the market…</p></section>;
  if (reads.isError) return <section className="panel"><EmptyState title="The market could not load"><p>Prices couldn't be loaded.</p><button className="text-button" onClick={() => void reads.refetch()}>Try again</button></EmptyState></section>;

  const visibleCategories = categories.filter(category => items.some(item => item.category === category && (item.price !== undefined || item.owned)));
  return <section className="panel shop-market">
    <nav className="shop-categories" aria-label="Shop categories">
      {visibleCategories.map(category => <a key={category} href={'#market-' + category}>{categoryLabels[category]}<Icon name="chevron" size={14} /></a>)}
    </nav>
    {visibleCategories.map(category => {
      // Items the owner hasn't listed on-chain yet stay hidden unless the player already owns one.
      const listed = items.map((item, index) => ({ item, index })).filter(({ item }) => item.category === category && (item.price !== undefined || item.owned));
      return <div key={category} id={'market-' + category} className={'shop-section shop-section-' + category}>
        <p className="eyebrow">{categoryLabels[category].toUpperCase()}</p>
        <ul className="shop-grid">{listed.map(({ item, index }) => <li key={item.id.toString()} className={item.premium ? 'shop-item premium' : 'shop-item'}>
          <div className={'shop-art shop-art-' + item.category} aria-hidden="true">
            <span className="shop-art-glow" />
            {item.category === 'lives'
              ? <Icon name="heart" size={70} className="shop-life-heart" />
              : <span className={'shop-preview shop-preview-' + item.category} style={{ background: itemPreview(item) }} />}
            <span className="shop-art-edition">{item.premium ? 'PREMIUM' : categoryLabels[item.category].toUpperCase()}</span>
          </div>
          <div className="shop-item-copy">
            <div className="shop-item-title"><h2>{item.name}</h2></div>
            <p className="muted shop-item-description">{item.description}</p>
            {item.category === 'lives' && lives.available !== undefined && <p className="shop-stock">You have <strong>{lives.available}</strong> extra {lives.available === 1 ? 'life' : 'lives'}</p>}
            <div className="shop-item-meta">
              <p className="price">{item.price !== undefined ? <><strong>{formatTokenAmount(item.price, gdDecimals)}</strong> G$</> : 'Price unavailable'}</p>
              {item.owned && <span className="shop-owned">{item.category !== 'lives' && equipped[item.category] === item.id ? 'Equipped' : 'Owned'}</span>}
            </div>
          </div>
          {item.category === 'lives'
            ? item.active && item.price !== undefined
              ? <TokenSpend spender={shop} amount={item.price} label={'Buy for ' + formatTokenAmount(item.price, gdDecimals) + ' G$'}
                  call={{ address: shop, abi: shopAbi, functionName: 'buy', args: [item.id, 1n, item.price] }}
                  onConfirmed={async () => {
                    const before = lives.available ?? 0;
                    // The backend reads packs on-chain; wait until it sees this purchase.
                    await refetchUntil(async () => ({ data: await lives.refresh() }), next => (next?.available ?? 0) > before);
                  }} />
              : <button className="button" disabled>Not for sale</button>
          : item.owned
            ? <button className="button secondary" aria-pressed={equipped[item.category] === item.id} onClick={() => equip(item.category, equipped[item.category] === item.id ? null : item.id)}>{equipped[item.category] === item.id ? 'Equipped · Unequip' : 'Equip item'}</button>
            : item.active && item.price !== undefined
              ? <TokenSpend spender={shop} amount={item.price} label={'Buy for ' + formatTokenAmount(item.price, gdDecimals) + ' G$'}
                  call={{ address: shop, abi: shopAbi, functionName: 'buy', args: [item.id, 1n, item.price] }}
                  // A new item is equipped straight away, so the next round shows it without a separate tap.
                  onConfirmed={async () => { equip(item.category, item.id); await refetchUntil(reads.refetch, data => ((data?.[index * 2 + 1]?.result as bigint | undefined) ?? 0n) > 0n); }} />
              : <button className="button" disabled>Not for sale</button>}
        </li>)}</ul>
      </div>;
    })}
    <p className="muted shop-market-note">Paid in G$. New cosmetics equip for your next run.</p>
  </section>;
}
