'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserPlus } from 'lucide-react';
import { adminRequest } from './auth-client';

/** Everyone who confirmed sign-in to Slyyce (wallet signature), and how sign-ups grow. */
export type Growth = { total: number; last24h: number; last7d: number; last30d: number; byMethod: { email: number; social: number; wallet: number; unknown: number }; daily: Array<{ date: string; signUps: number; total: number }> };
type Player = { id: string; createdAt: string; wallets: Array<{ address: string; signInMethod?: string | null }> };

const methodLabels: Record<string, string> = { email: 'Email', social: 'Social', wallet: 'Wallet' };
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

async function getJson<T>(path: string): Promise<T> {
  const response = await adminRequest(path);
  if (!response.ok) throw new Error(`The player service returned ${response.status}.`);
  return await response.json() as T;
}

export function useGrowth(days = 30) {
  const [growth, setGrowth] = useState<Growth>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getJson<{ data: Growth }>(`/api/v1/admin/players/growth?days=${days}`)
      .then(body => { if (active) setGrowth(body.data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Sign-up data is unavailable.'); });
    return () => { active = false; };
  }, [days]);
  return { growth, error };
}

function GrowthChart({ daily }: { daily: Growth['daily'] }) {
  const max = Math.max(1, ...daily.map(day => day.signUps));
  const first = daily[0];
  const last = daily.at(-1);
  return <figure className="admin-growth">
    <div className="admin-growth-bars" role="img" aria-label={`Daily sign-ups over the last ${daily.length} days`}>
      {daily.map(day => <div key={day.date} className="admin-growth-col" tabIndex={0} aria-label={`${shortDate(day.date)}: ${day.signUps} sign-ups, ${day.total} total`}>
        <span className="admin-growth-bar" style={{ height: `${(day.signUps / max) * 100}%` }} />
        <span className="admin-growth-tip" role="tooltip"><strong>{day.signUps.toLocaleString()} new</strong>{shortDate(day.date)} · {day.total.toLocaleString()} total</span>
      </div>)}
    </div>
    {first && last && <figcaption className="admin-growth-axis"><span>{shortDate(first.date)}</span><span>Peak {max.toLocaleString()}/day</span><span>{shortDate(last.date)}</span></figcaption>}
    <details className="admin-growth-table"><summary>Show as table</summary>
      <table><thead><tr><th>Day</th><th>New</th><th>Total</th></tr></thead>
        <tbody>{[...daily].reverse().map(day => <tr key={day.date}><td>{shortDate(day.date)}</td><td>{day.signUps}</td><td>{day.total}</td></tr>)}</tbody></table>
    </details>
  </figure>;
}

export function SignUps() {
  const { growth, error } = useGrowth(30);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async (from: string | null) => {
    setState('loading');
    try {
      const query = new URLSearchParams({ limit: '25', ...(from ? { cursor: from } : {}) });
      const body = await getJson<{ data: Player[]; pagination: { nextCursor: string | null } }>(`/api/v1/admin/players?${query}`);
      setPlayers(current => from ? [...current, ...body.data] : body.data);
      setCursor(body.pagination.nextCursor); setState('ready');
    } catch { setState('error'); }
  }, []);
  useEffect(() => { void load(null); }, [load]);

  return <>
    <section className="admin-panel admin-chain-panel">
      <div className="admin-panel-heading"><div><p className="eyebrow">GROWTH</p><h2>Sign-ups {growth ? `· ${growth.total.toLocaleString()}` : ''}</h2></div>
        {growth && <span className="muted">Email {growth.byMethod.email} · Social {growth.byMethod.social} · Wallet {growth.byMethod.wallet}{growth.byMethod.unknown ? ` · Earlier ${growth.byMethod.unknown}` : ''}</span>}</div>
      {error ? <div className="admin-ops-error" role="alert"><UserPlus size={20} /><span>{error}</span></div> : !growth ? <div className="admin-empty"><RefreshCw size={26} /><p>Loading sign-ups</p></div> : <>
        <div className="admin-growth-stats">
          <div><small>Last 24 hours</small><strong>+{growth.last24h.toLocaleString()}</strong></div>
          <div><small>Last 7 days</small><strong>+{growth.last7d.toLocaleString()}</strong></div>
          <div><small>Last 30 days</small><strong>+{growth.last30d.toLocaleString()}</strong></div>
        </div>
        <GrowthChart daily={growth.daily} />
      </>}
    </section>
    <section className="admin-panel admin-chain-panel" style={{ marginTop: 12 }}>
      <div className="admin-panel-heading"><div><p className="eyebrow">NEWEST FIRST</p><h2>Everyone who signed up</h2></div></div>
      {players.length === 0 ? <div className="admin-empty">{state === 'loading' ? <RefreshCw size={26} /> : <UserPlus size={26} />}<p>{state === 'loading' ? 'Loading sign-ups' : state === 'error' ? 'Sign-ups are unavailable' : 'No sign-ups yet'}</p></div> :
        <div className="admin-chain-table" role="table" aria-label="Sign-ups">
          <div className="admin-chain-row admin-chain-head admin-signup-row" role="row"><span role="columnheader">Wallet</span><span role="columnheader">Signed in with</span><span role="columnheader">Joined</span></div>
          {players.map(player => { const wallet = player.wallets[0]; return <div className="admin-chain-row admin-signup-row" role="row" key={player.id}>
            <span role="cell" data-label="Wallet">{wallet ? <Link href={`/player?address=${wallet.address}`} className="admin-chain-address" title={wallet.address}>{shortAddress(wallet.address)}</Link> : '—'}</span>
            <span role="cell" data-label="Signed in with">{methodLabels[wallet?.signInMethod ?? ''] ?? '—'}</span>
            <span role="cell" data-label="Joined">{new Date(player.createdAt).toLocaleString()}</span>
          </div>; })}
        </div>}
      {cursor && <button className="button secondary admin-load-more" disabled={state === 'loading'} onClick={() => void load(cursor)}>{state === 'loading' ? 'Loading…' : 'Load more'}</button>}
    </section>
  </>;
}
