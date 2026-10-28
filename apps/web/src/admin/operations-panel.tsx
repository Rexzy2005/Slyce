'use client';

import { createElement as h, useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Activity, ClipboardList, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';
import { getAdminAuthClient } from './supabase';

type Metrics = { generatedAt: string; players: { total: number; active: number }; goodDollar: { verifiedRootIdentities: number }; gameplay: { activeSessions: number; verifiedScores: number }; content: { publishedChallenges: number; publishedBounties: number }; rewards: { pendingReview: number; approved: number; distributionPending: number; distributed: number; failed: number }; health: { database: 'reachable' } };
type Audit = { id: string; action: string; entityType: string; entityId: string; reason: string | null; createdAt: string; administrator: { email: string | null; displayName: string | null } };

async function adminGet(path: string) {
  const { data: { session } } = await getAdminAuthClient().auth.getSession();
  if (!session || !publicConfig.backendUrl) throw new Error('Administrator session is unavailable.');
  const response = await apiFetch(`${publicConfig.backendUrl}${path}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Operational service returned ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export function OperationsPanel() {
  const [metrics, setMetrics] = useState<Metrics>();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = useCallback(async (append = false, querySearch = '', queryCursor: string | null = null) => {
    setState('loading');
    try {
      const query = new URLSearchParams({ limit: '8' });
      if (append && queryCursor) query.set('cursor', queryCursor);
      if (querySearch.trim()) query.set('search', querySearch.trim());
      const [metricBody, auditBody] = await Promise.all([adminGet('/api/v1/admin/metrics'), adminGet(`/api/v1/admin/audit-logs?${query}`)]);
      const metricData = (metricBody as { data: Metrics }).data;
      const auditData = auditBody as { data: Audit[]; pagination: { nextCursor: string | null } };
      setMetrics(metricData);
      setAudits(current => append ? [...current, ...auditData.data] : auditData.data);
      setCursor(auditData.pagination.nextCursor);
      setState('ready');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operational visibility is unavailable.'); setState('error'); }
  }, []);

  useEffect(() => { void load(false); }, [load]);
  const submit = (event: FormEvent) => { event.preventDefault(); setCursor(null); void load(false, search); };
  const card = (label: string, value: number | undefined, detail: string, tone: string) => h('article', { className: `admin-metric admin-tone-${tone}`, key: label }, h('span', { className: 'admin-metric-icon' }, h(Activity, { size: 17 })), h('p', null, label), h('strong', null, value === undefined ? '—' : value.toLocaleString()), h('small', null, detail));

  return h('div', { className: 'admin-operations' },
    h('section', { className: 'admin-section' },
      h('div', { className: 'admin-section-heading' }, h('div', null, h('p', { className: 'eyebrow' }, 'PERSISTED OPERATIONS'), h('h2', null, 'Platform pulse')), h('span', { className: 'muted' }, metrics ? `Generated ${new Date(metrics.generatedAt).toLocaleTimeString()}` : 'Loading authoritative records')),
      state === 'error' && !metrics ? h('div', { className: 'admin-ops-error' }, h(ShieldCheck, { size: 20 }), h('span', null, message), h('button', { className: 'button secondary', onClick: () => void load(false) }, 'Retry')) :
        h('div', { className: 'admin-metric-grid' }, card('Active players', metrics?.players.active, 'Distinct active player records', 'mango'), card('Verified identities', metrics?.goodDollar.verifiedRootIdentities, 'Distinct GoodDollar roots', 'leaf'), card('Verified scores', metrics?.gameplay.verifiedScores, 'Server-verified records', 'sky'), card('Rewards pending', metrics?.rewards.pendingReview, 'Eligible or pending review', 'melon')),
    ),
    h('section', { className: 'admin-panel admin-audit-panel' },
      h('div', { className: 'admin-panel-heading' }, h('div', null, h('p', { className: 'eyebrow' }, 'ACCOUNTABILITY'), h('h2', null, 'Recent administrative activity')), h('span', { className: 'admin-panel-status' }, metrics?.health.database === 'reachable' ? 'Database reachable' : 'Checking')),
      h('form', { className: 'admin-audit-search', onSubmit: submit }, h(Search, { size: 16 }), h('input', { value: search, onChange: (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value), placeholder: 'Search entity ID or reason', 'aria-label': 'Search audit activity' }), h('button', { className: 'button secondary', type: 'submit' }, 'Search')),
      state === 'loading' && audits.length === 0 ? h('div', { className: 'admin-empty' }, h(RefreshCw, { size: 26 }), h('p', null, 'Loading audit records')) : audits.length === 0 ? h('div', { className: 'admin-empty' }, h(ClipboardList, { size: 26 }), h('p', null, 'No matching audit records')) : h('div', { className: 'admin-audit-list' }, audits.map(item => h('article', { className: 'admin-audit-row', key: item.id }, h('div', null, h('strong', null, `${item.action} ${item.entityType}`), h('span', null, item.entityId)), h('div', null, h('span', null, item.administrator.displayName ?? item.administrator.email ?? 'Administrator'), h('time', { dateTime: item.createdAt }, new Date(item.createdAt).toLocaleString())), item.reason ? h('p', null, item.reason) : null))),
      cursor ? h('button', { className: 'button secondary admin-load-more', disabled: state === 'loading', onClick: () => void load(true, search, cursor) }, state === 'loading' ? 'Loading…' : 'Load more') : null,
    ),
  );
}
