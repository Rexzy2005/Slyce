'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { formatGd, gdTotal, kindLabels, payoutKinds, spendKinds, type ChainSummary, type TransactionKind } from './format';

/** Activity summary from the public chain index (the same data the admin console reads). */
export function useActivitySummary(): { summary: ChainSummary | undefined; failed: boolean } {
  const [summary, setSummary] = useState<ChainSummary>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!publicConfig.backendUrl) { setFailed(true); return; }
    let active = true;
    void apiFetch(`${publicConfig.backendUrl}/api/v1/chain/transactions?limit=1`)
      .then(async response => { if (!response.ok) throw new Error(String(response.status)); return await response.json() as { summary: ChainSummary }; })
      .then(body => { if (active) setSummary(body.summary); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return { summary, failed };
}

function Rows({ summary, kinds }: { summary: ChainSummary; kinds: readonly TransactionKind[] }) {
  return <>{kinds.map(kind => { const row = summary.byKind?.[kind]; return <li key={kind}><span>{kindLabels[kind]}<small className="muted"> · {(row?.count ?? 0).toLocaleString()}</small></span><strong>{formatGd(row?.amount ?? '0')}</strong></li>; })}</>;
}

/** Public /stats section: loads the summary itself. */
export function GdFlowSection() {
  const { summary, failed } = useActivitySummary();
  return <section className="recent-activity" aria-labelledby="gd-flow-title"><h2 id="gd-flow-title">G$ in Slyyce</h2>
    {summary ? <GdFlow summary={summary} /> : <p className="muted" role="status">{failed ? 'G$ totals couldn’t be loaded right now.' : 'Loading G$ totals…'}</p>}</section>;
}

/** G$ flowing through Slyyce: spent by players (shop, tournaments, fees) and paid back to players. */
export function GdFlow({ summary }: { summary: ChainSummary }) {
  const spent = gdTotal(summary, spendKinds), paid = gdTotal(summary, payoutKinds);
  const funded = summary.byKind?.rewards_funded;
  return <div className="gd-flow">
    <section><h3>G$ spent in Slyyce <strong>{formatGd(spent.amount.toString())}</strong></h3><ul><Rows summary={summary} kinds={spendKinds} /></ul></section>
    <section><h3>G$ paid to players <strong className="leaf">{formatGd(paid.amount.toString())}</strong></h3><ul><Rows summary={summary} kinds={payoutKinds} /></ul></section>
    {funded && <p className="muted fine-print">Reward pot funded by Slyyce: {formatGd(funded.amount)} ({funded.count.toLocaleString()}×).</p>}
  </div>;
}
