'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Mail, X } from 'lucide-react';
import { getAdminAuthClient } from './supabase';
import { publicConfig } from '../config/public';
import { apiFetch } from '../api/http';

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
      const response = await apiFetch(`${publicConfig.backendUrl ?? ''}/api/v1/session`, {
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
  const [signInOpen, setSignInOpen] = useState(false);
  const signOut = async () => { await getAdminAuthClient().auth.signOut(); window.location.reload(); };
  return <main className="admin-access"><div className="admin-access-card">
    <span className="brand">slyce<span className="brand-dot">/</span></span>
    <p className="eyebrow">OPERATIONS CONSOLE</p>
    <h1>{state === 'signed-out' ? 'Sign in to Slyce.' : state === 'forbidden' ? 'Access restricted.' : 'Admin console unavailable.'}</h1>
    <p className="muted">{message}</p>
    {email && <p className="admin-session-email">{email}</p>}
    {state === 'signed-out' && <button className="button admin-primary-action" onClick={() => setSignInOpen(true)}>Email me a secure link</button>}
    {state === 'forbidden' && <button className="button secondary" onClick={() => void signOut()}>Use another account</button>}
    {state === 'loading' && <div className="admin-loading-bar" aria-label="Loading" />}
  </div>
    {signInOpen && <AdminSignInModal onClose={() => setSignInOpen(false)} />}
  </main>;
}

function AdminSignInModal({ onClose }: { onClose: () => void }) {
  const modal = useRef<HTMLElement>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setStatus('submitting');
    setError('');
    try {
      const result = await getAdminAuthClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (result.error) {
        setStatus('error');
        setError(result.error.message || 'Unable to send the secure link. Please try again.');
        return;
      }
      setEmail(normalizedEmail);
      setStatus('sent');
    } catch {
      setStatus('error');
      setError('Unable to contact the authentication service. Please try again.');
    }
  };

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && status !== 'submitting') onClose();
  }}>
    <section ref={modal} className="admin-auth-modal" role="dialog" aria-modal="true" aria-labelledby="admin-signin-title" onKeyDown={event => {
      if (event.key === 'Escape' && status !== 'submitting') onClose();
      if (event.key === 'Tab') {
        const focusable = [...(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      }
    }}>
      <button className="admin-modal-close" type="button" aria-label="Close sign-in" onClick={onClose} disabled={status === 'submitting'}><X size={18} /></button>
      {status === 'sent' ? <>
        <span className="admin-modal-icon admin-modal-success"><CheckCircle2 size={24} /></span>
        <p className="eyebrow">SECURE LINK SENT</p>
        <h2 id="admin-signin-title">Check your inbox.</h2>
        <p className="muted">We sent an administrator sign-in link to <strong>{email}</strong>. The link returns to this console and expires automatically.</p>
        <button className="button admin-modal-action" type="button" onClick={onClose}>Done</button>
      </> : <>
        <span className="admin-modal-icon"><Mail size={22} /></span>
        <p className="eyebrow">ADMINISTRATOR ACCESS</p>
        <h2 id="admin-signin-title">Enter your approved email.</h2>
        <p className="muted">We will send a one-time sign-in link. Your email must be included in the administrator allowlist.</p>
        <form onSubmit={event => void submit(event)}>
          <label className="admin-email-label" htmlFor="admin-email">Email address</label>
          <input id="admin-email" className="admin-email-input" type="email" inputMode="email" autoComplete="email" autoFocus required placeholder="operator@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={status === 'submitting'} aria-describedby={status === 'error' ? 'admin-signin-error' : undefined} />
          {status === 'error' && <p className="admin-modal-error" id="admin-signin-error" role="alert">{error}</p>}
          <button className="button admin-modal-action" type="submit" disabled={status === 'submitting' || !email.trim()}>
            {status === 'submitting' ? 'Sending secure link…' : <><span>Send secure link</span><ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="admin-modal-footnote">Access is granted only after Supabase verifies the email and the backend confirms administrator permission.</p>
      </>}
    </section>
  </div>;
}
