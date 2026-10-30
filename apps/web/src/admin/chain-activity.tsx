'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeftRight, ExternalLink, RefreshCw, Search, Users } from 'lucide-react';
import { adminRequest } from './auth-client';
import { publicConfig } from '../config/public';
import { explorerUrl, gdDecimals } from '../web3/config';
import { formatTokenAmount } from '../web3/units';

/** Admin views over on-chain player activity served by the backend index (ADR-0012). */
export type ChainSummary = { users: number; transactions: number; games: number; earned: string; spent: string; indexedToBlock: number | null; latestBlock: number | null; catchingUp: boolean };
type ChainUser = { address: string; firstSeen: string | null; lastSeen: string | null; transactions: number; games: number; bestScore: number; xp: number; earned: string; spent: string };
type ChainTransaction = { id: string; kind: TransactionKind; account: string; transactionHash: string; blockNumber: number; timestamp: string | null; amount: string | null; direction: 'in' | 'out' | null; details: Record<string, string | number> };
type TransactionKind = keyof typeof kindLabels;
type Page<T> = { data: T[]; summary: ChainSummary; pagination: { nextCursor: string | null } };

const kindLabels = {
  game: 'Game saved',
  milestone_reward: 'Milestone reward',
  round_fee: 'Round fee',
  rewards_funded: 'Reward pot funded',
  purchase: 'Shop purchase',
  tournament_entry: 'Tournament entry',
  sponsor: 'Tournament sponsor',
  tournament_score: 'Tournament score',
  prize_claim: 'Prize claimed',
  refund: 'Refund',
} as const;

const detailLabels: Record<string, string> = { gameId: 'game #', tournamentId: 'tournament #', itemId: 'item #', round: 'round #', bestCombo: 'combo', milestone: 'milestone' };
const describe = (details: Record<string, string | number>) => Object.entries(details).map(([name, value]) => `${detailLabels[name] ?? name} ${typeof value === 'number' ? value.toLocaleString() : value}`.replace('# ', '#')).join(' · ') || '—';
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const gd = (amount: string) => `${Number(formatTokenAmount(BigInt(amount), gdDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} G$`;
const when = (value: string | null) => value ? new Date(value).toLocaleString() : '—';
const link = (kind: 'address' | 'tx', value: string) => publicConfig.network ? explorerUrl(publicConfig.network, kind, value) : null;

async function loadPage<T>(path: string, query: URLSearchParams): Promise<Page<T>> {
  const response = await adminRequest(`/api/v1/admin/chain/${path}?${query}`);
  if (response.status === 503) throw new Error('On-chain activity is not configured on the backend yet.');
  if (!response.ok) throw new Error(`The activity service returned ${response.status}.`);
  return await response.json() as Page<T>;
}

function usePaged<T>(path: string, filters: Record<string, string>) {
  const [rows, setRows] = useState<T[]>([]);
  const [summary, setSummary] = useState<ChainSummary>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const key = JSON.stringify(filters);
  const load = useCallback(async (from: string | null) => {
    setState('loading');
    try {
      const query = new URLSearchParams({ limit: '25', ...JSON.parse(key) as Record<string, string> });
      if (from) query.set('cursor', from);
      const page = await loadPage<T>(path, query);
      setRows(current => from ? [...current, ...page.data] : page.data);
      setSummary(page.summary); setCursor(page.pagination.nextCursor); setState('ready');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'On-chain activity is unavailable.'); setState('error'); }
  }, [path, key]);
  useEffect(() => { void load(null); }, [load]);
  return { rows, summary, cursor, state, message, reload: () => void load(null), more: () => void load(cursor) };
}

function SyncNote({ summary }: { summary: ChainSummary | undefined }) {
  if (!summary) return <span className="muted">Reading Celo…</span>;
  return <span className="muted">{summary.catchingUp ? 'Still catching up with Celo, refresh shortly' : `Up to date at block ${summary.latestBlock?.toLocaleString() ?? '—'}`}</span>;
}

function Status({ state, message, empty, onRetry }: { state: 'loading' | 'ready' | 'error'; message: string; empty: string; onRetry: () => void }) {
  if (state === 'error') return <div className="admin-ops-error" role="alert"><ArrowLeftRight size={20} /><span>{message}</span><button className="button secondary" onClick={onRetry}>Retry</button></div>;
  return <div className="admin-empty">{state === 'loading' ? <RefreshCw size={26} /> : <Users size={26} />}<p>{state === 'loading' ? 'Reading on-chain activity' : empty}</p></div>;
}

function Address({ value }: { value: string }) {
  return <Link href={`/player?address=${value}`} className="admin-chain-address" title={value}>{shortAddress(value)}</Link>;
}

export function ChainPlayers({ onSelect }: { onSelect: (address: string) => void }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const { rows, summary, cursor, state, message, reload, more } = usePaged<ChainUser>('users', search ? { search } : {});
  const submit = (event: FormEvent) => { event.preventDefault(); setSearch(input.trim().toLowerCase()); };
  return <section className="admin-panel admin-chain-panel">
    <div className="admin-panel-heading"><div><p className="eyebrow">ON CELO</p><h2>Players {summary && !search ? `· ${summary.users.toLocaleString()}` : ''}</h2></div><SyncNote summary={summary} /></div>
    <form className="admin-audit-search" onSubmit={submit}><Search size={16} /><input value={input} onChange={event => setInput(event.target.value)} placeholder="Search wallet address" aria-label="Search players by wallet address" /><button className="button secondary" type="submit">Search</button></form>
    {rows.length === 0 ? <Status state={state} message={message} empty={search ? 'No player matches that address' : 'No player has used the contracts yet'} onRetry={reload} /> :
      <div className="admin-chain-table" role="table" aria-label="Players">
        <div className="admin-chain-row admin-chain-head" role="row"><span role="columnheader">Wallet</span><span role="columnheader">Games</span><span role="columnheader">Best</span><span role="columnheader">XP</span><span role="columnheader">Earned</span><span role="columnheader">Spent</span><span role="columnheader">Last active</span><span role="columnheader" /></div>
        {rows.map(user => <div className="admin-chain-row" role="row" key={user.address}>
          <span role="cell" data-label="Wallet"><Address value={user.address} /></span>
          <span role="cell" data-label="Games">{user.games.toLocaleString()}</span>
          <span role="cell" data-label="Best">{user.bestScore.toLocaleString()}</span>
          <span role="cell" data-label="XP">{user.xp.toLocaleString()}</span>
          <span role="cell" data-label="Earned" className="admin-chain-in">{gd(user.earned)}</span>
          <span role="cell" data-label="Spent">{gd(user.spent)}</span>
          <span role="cell" data-label="Last active">{when(user.lastSeen)}</span>
          <span role="cell"><button className="button secondary admin-chain-action" onClick={() => onSelect(user.address)}>{user.transactions} tx</button></span>
        </div>)}
      </div>}
    {cursor && <button className="button secondary admin-load-more" disabled={state === 'loading'} onClick={more}>{state === 'loading' ? 'Loading…' : 'Load more'}</button>}
  </section>;
}

export function ChainTransactions({ account, onClearAccount }: { account: string | null; onClearAccount: () => void }) {
  const [kind, setKind] = useState<TransactionKind | ''>('');
  const filters: Record<string, string> = { ...(kind ? { kind } : {}), ...(account ? { account } : {}) };
  const { rows, summary, cursor, state, message, reload, more } = usePaged<ChainTransaction>('transactions', filters);
  return <section className="admin-panel admin-chain-panel">
    <div className="admin-panel-heading"><div><p className="eyebrow">ON CELO</p><h2>Transactions {summary && !kind && !account ? `· ${summary.transactions.toLocaleString()}` : ''}</h2></div><SyncNote summary={summary} /></div>
    <div className="admin-chain-filters">
      <select value={kind} onChange={event => setKind(event.target.value as TransactionKind | '')} aria-label="Filter by type">
        <option value="">All types</option>
        {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {account && <button className="button secondary" onClick={onClearAccount}>{shortAddress(account)} ✕</button>}
    </div>
    {rows.length === 0 ? <Status state={state} message={message} empty="No matching transactions yet" onRetry={reload} /> :
      <div className="admin-chain-table" role="table" aria-label="Transactions">
        <div className="admin-chain-row admin-chain-head admin-chain-tx" role="row"><span role="columnheader">Type</span><span role="columnheader">Wallet</span><span role="columnheader">Amount</span><span role="columnheader">Details</span><span role="columnheader">Time</span><span role="columnheader" /></div>
        {rows.map(row => {
          const tx = link('tx', row.transactionHash);
          return <div className="admin-chain-row admin-chain-tx" role="row" key={row.id}>
            <span role="cell" data-label="Type"><strong>{kindLabels[row.kind]}</strong></span>
            <span role="cell" data-label="Wallet"><Address value={row.account} /></span>
            <span role="cell" data-label="Amount" className={row.direction === 'in' ? 'admin-chain-in' : undefined}>{row.amount ? `${row.direction === 'in' ? '+' : '−'}${gd(row.amount)}` : '—'}</span>
            <span role="cell" data-label="Details">{describe(row.details)}</span>
            <span role="cell" data-label="Time">{when(row.timestamp)}</span>
            <span role="cell">{tx && <a href={tx} target="_blank" rel="noreferrer" className="admin-chain-link" aria-label="View on block explorer"><ExternalLink size={14} /></a>}</span>
          </div>;
        })}
      </div>}
    {cursor && <button className="button secondary admin-load-more" disabled={state === 'loading'} onClick={more}>{state === 'loading' ? 'Loading…' : 'Load more'}</button>}
  </section>;
}

/** Totals for the overview cards; undefined while loading or when the index is unavailable. */
export function useChainSummary(): ChainSummary | undefined {
  const [summary, setSummary] = useState<ChainSummary>();
  useEffect(() => {
    let active = true;
    void loadPage<ChainTransaction>('transactions', new URLSearchParams({ limit: '1' })).then(page => { if (active) setSummary(page.summary); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return summary;
}

export const formatGd = gd;
