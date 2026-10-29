'use client';
import { useEffect, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { publicConfig } from '../config/public';
import { EmptyState } from '../components/ui';
import { useWallet } from '../web3/context';
import { shopAbi } from '../web3/abis';
import { chainFor, contractsFor, gdDecimals } from '../web3/config';
import { TokenSpend } from '../web3/token-spend';
import { formatTokenAmount } from '../web3/units';
import { bladeItems, readEquippedBlade, writeEquippedBlade } from './catalog';
/** On-chain price, availability and ownership for every catalog item. */
export function useShopItems() {
  const account = useAccount();
  const shop = contractsFor(publicConfig).shop;
  const chain = publicConfig.network ? chainFor(publicConfig.network) : undefined;
  const reads = useReadContracts({
    contracts: shop && chain ? bladeItems.flatMap(item => [
      { address: shop, abi: shopAbi, functionName: 'items', args: [item.id], chainId: chain.id } as const,
      { address: shop, abi: shopAbi, functionName: 'purchased', args: [account.address ?? '0x0000000000000000000000000000000000000000', item.id], chainId: chain.id } as const,
    ]) : [],
    query: { enabled: !!shop && !!chain },
  });
  const items = bladeItems.map((item, index) => {
    const listing = reads.data?.[index * 2]?.result as { price: bigint; maxPerWallet: number; active: boolean; exists: boolean } | undefined;
    const owned = account.address ? reads.data?.[index * 2 + 1]?.result as bigint | undefined : 0n;
    return { ...item, price: listing?.exists ? listing.price : undefined, active: !!listing?.exists && listing.active, owned: (owned ?? 0n) > 0n };
  });
  return { shop, items, reads };
}
export function Shop() {
  const wallet = useWallet();
  // Wagmi hooks need the wallet provider, which only mounts when Web3 is configured.
  if (!wallet.live) return <section className="panel"><EmptyState title="The market is getting ready"><p>{wallet.message ?? 'Wallet connection is not configured for this environment.'}</p></EmptyState></section>;
  return <Market />;
}
function Market() {
  const { shop, items, reads } = useShopItems();
  const [equipped, setEquipped] = useState<bigint | null>(null);
  useEffect(() => setEquipped(readEquippedBlade()), []);
  function equip(id: bigint | null) { writeEquippedBlade(id); setEquipped(id); }
  if (!shop) return <section className="panel"><EmptyState title="The market is getting ready"><p>The shop contract is not configured for this environment.</p></EmptyState></section>;
  if (reads.isPending) return <section className="panel"><p className="loading-state" role="status">Loading the market…</p></section>;
  if (reads.isError) return <section className="panel"><EmptyState title="The market could not load"><p>Prices could not be read from the blockchain.</p><button className="text-button" onClick={() => void reads.refetch()}>Try again</button></EmptyState></section>;
  return <section className="panel"><p className="eyebrow">BLADE TRAILS · COSMETIC</p>
    <ul className="shop-grid">{items.map(item => <li key={item.id.toString()} className="shop-item">
      <span className="blade-swatch" style={{ background: 'linear-gradient(120deg, #' + item.colors.glow.toString(16).padStart(6, '0') + ', #' + item.colors.core.toString(16).padStart(6, '0') + ')' }} aria-hidden="true" />
      <div><h2>{item.name}</h2><p className="muted">{item.description}</p>
        <p className="price">{item.price !== undefined ? formatTokenAmount(item.price, gdDecimals) + ' G$' : 'Price unavailable'}</p></div>
      {item.owned
        ? <button className="button secondary" aria-pressed={equipped === item.id} onClick={() => equip(equipped === item.id ? null : item.id)}>{equipped === item.id ? 'Equipped · Unequip' : 'Equip'}</button>
        : item.active && item.price !== undefined
          ? <TokenSpend spender={shop} amount={item.price} label={'Buy for ' + formatTokenAmount(item.price, gdDecimals) + ' G$'}
              call={{ address: shop, abi: shopAbi, functionName: 'buy', args: [item.id, 1n, item.price] }} onConfirmed={() => reads.refetch()} />
          : <button className="button" disabled>Not for sale</button>}
    </li>)}</ul>
    <p className="muted">Purchases are paid in G$ to the Slyce treasury and recorded on-chain. Equipped blades show in the arena.</p></section>;
}
