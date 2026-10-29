'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isAddress, type Address } from 'viem';
import { publicConfig } from '../config/public';
import { explorerUrl } from '../web3/config';
import { useWallet } from '../web3/context';
import { PlayerCard } from '../game/player-card';
/** Shareable, sign-in-free player profile read straight from SlyceArcade. */
export function PublicPlayer() {
  const wallet = useWallet();
  const param = useSearchParams().get('address') ?? '';
  const valid = isAddress(param);
  return <div className="stats">
    <Link href="/play" className="brand">slyyce<span className="brand-dot">/</span></Link>
    <h1>Player record</h1>
    {!valid ? <p className="error-text" role="alert">This profile link is missing a valid wallet address.</p> : <>
      <p className="muted"><code>{param.slice(0, 8)}…{param.slice(-6)}</code>{publicConfig.network && <> · <a href={explorerUrl(publicConfig.network, 'address', param)} target="_blank" rel="noreferrer">Celoscan ↗</a></>}</p>
      {wallet.status === 'unavailable' ? <p className="muted">Stats are not configured for this environment.</p> : wallet.live ? <PlayerCard player={param as Address} /> : <p className="loading-state" role="status">Reading Celo…</p>}
    </>}
    <Link className="button" href="/how-to-play">How to play Slyyce</Link>
  </div>;
}
