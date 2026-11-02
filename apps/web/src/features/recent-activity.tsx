'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { explorerUrl } from '../web3/config';
import { describe, formatGd, kindLabels, shortAddress, when, type ChainTransaction, type TransactionKind } from '../activity/format';

type Page = { data: ChainTransaction[]; pagination: { nextCursor: string | null } };

/** Public feed of every player transaction on the Slyyce contracts, newest first (backend chain index, ADR-0012). */
export function RecentActivity() {
  const [kind, setKind] = useState<TransactionKind | ''>('');
  const [rows, setRows] = useState<ChainTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async (from: string | null) => {
    if (!publicConfig.backendUrl) { setState('error'); return; }
    setState('loading');
    try {
      const query = new URLSearchParams({ limit: '20', ...(kind ? { kind } : {}), ...(from ? { cursor: from } : {}) });
      const response = await apiFetch(`${publicConfig.backendUrl}/api/v1/chain/transactions?${query}`);
      if (!response.ok) throw new Error(String(response.status));
      const page = await response.json() as Page;
      setRows(current => from ? [...current, ...page.data] : page.data);
      setCursor(page.pagination.nextCursor); setState('ready');
    } catch { setState('error'); }
  }, [kind]);
  useEffect(() => { void load(null); }, [load]);
  const network = publicConfig.network;
  return <section className="recent-activity" aria-labelledby="recent-activity-title">
    <div className="recent-activity-head">
      <h2 id="recent-activity-title">All activity</h2>
      <select value={kind} onChange={event => setKind(event.target.value as TransactionKind | '')} aria-label="Filter by type">
        <option value="">All types</option>
        {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {rows.length === 0
      ? <p className="muted" role="status">{state === 'loading' ? 'Loading activity…' : state === 'error' ? 'Activity couldn’t be loaded right now.' : 'No activity yet.'}</p>
      : <ul className="activity-list">{rows.map(row => <li key={row.id}>
          <div><strong>{kindLabels[row.kind]}</strong><span className="muted">{describe(row.details)}</span></div>
          <div className="activity-meta">
            {row.amount && <span className={row.direction === 'in' ? 'leaf' : undefined}>{row.direction === 'in' ? '+' : '−'}{formatGd(row.amount)}</span>}
            <Link href={`/player?address=${row.account}`}>{shortAddress(row.account)}</Link>
            <time dateTime={row.timestamp ?? undefined}>{when(row.timestamp)}</time>
            {network && <a href={explorerUrl(network, 'tx', row.transactionHash)} target="_blank" rel="noreferrer" aria-label="View public record">↗</a>}
          </div>
        </li>)}</ul>}
    {cursor && <button className="button secondary" disabled={state === 'loading'} onClick={() => void load(cursor)}>{state === 'loading' ? 'Loading…' : 'Load more'}</button>}
  </section>;
}
