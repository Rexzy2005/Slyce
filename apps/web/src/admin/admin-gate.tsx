'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getAdminAuthClient } from './supabase';
import { publicConfig } from '../config/public';

type GateState = 'loading' | 'signed-out' | 'forbidden' | 'ready' | 'error';

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [email, setEmail] = useState<string>();
  const [message, setMessage] = useState('Checking administrator access.');

  useEffect(() => {
    let active = true;
    const client = (() => {
      try { return getAdminAuthClient(); } catch (error) {
        if (active) { setState('error'); setMessage(error instanceof Error ? error.message : 'Admin authentication is unavailable.'); }
        return undefined;
      }
    })();
    if (!client) return () => { active = false; };

    const check = async () => {
      const { data: { session } } = await client.auth.getSession();
      if (!session) { if (active) setState('signed-out'); return; }
      const response = await fetch(`${publicConfig.backendUrl ?? ''}/api/v1/session`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (!active) return;
      if (response.status === 401) { setState('signed-out'); return; }
      if (!response.ok) { setState('error'); setMessage('The administrator session could not be verified.'); return; }
      const body = await response.json() as { data?: { kind?: string; email?: string } };
      if (body.data?.kind !== 'administrator') { setState('forbidden'); setMessage('This account is not on the Slyce administrator allowlist.'); return; }
      setEmail(body.data.email);
      setState('ready');
    };
    void check().catch(() => { if (active) { setState('error'); setMessage('The administrator session could not be verified.'); } });
    const { data: listener } = client.auth.onAuthStateChange(() => { void check(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (state === 'ready') return <>{children}</>;
  return <AdminAccessScreen state={state} message={message} {...(email ? { email } : {})} />;
}

function AdminAccessScreen({ state, email, message }: { state: GateState; email?: string; message: string }) {
  const signIn = async () => {
    const client = getAdminAuthClient();
    const value = window.prompt('Enter your administrator email');
    if (!value) return;
    const result = await client.auth.signInWithOtp({ email: value.trim(), options: { emailRedirectTo: `${window.location.origin}/admin` } });
    if (result.error) window.alert('Unable to send the sign-in link. Please try again.');
    else window.alert('Check your email for the secure Slyce admin sign-in link.');
  };
  const signOut = async () => { await getAdminAuthClient().auth.signOut(); window.location.reload(); };
  return <main className="admin-access"><div className="admin-access-card">
    <span className="brand">slyce<span className="brand-dot">/</span></span>
    <p className="eyebrow">OPERATIONS CONSOLE</p>
    <h1>{state === 'signed-out' ? 'Sign in to Slyce.' : state === 'forbidden' ? 'Access restricted.' : 'Admin console unavailable.'}</h1>
    <p className="muted">{message}</p>
    {email && <p className="admin-session-email">{email}</p>}
    {state === 'signed-out' && <button className="button admin-primary-action" onClick={() => void signIn()}>Email me a secure link</button>}
    {state === 'forbidden' && <button className="button secondary" onClick={() => void signOut()}>Use another account</button>}
    {state === 'loading' && <div className="admin-loading-bar" aria-label="Loading" />}
  </div></main>;
}
