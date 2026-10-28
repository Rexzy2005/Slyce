'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Mail, X } from 'lucide-react';
import { clearAdminSessionStart, getAdminAuthClient, isAdminSessionWithinMaximumAge, recordAdminSessionStart } from './supabase';
import { publicConfig } from '../config/public';
import { apiFetch } from '../api/http';

type GateState = 'loading' | 'signed-out' | 'forbidden' | 'ready' | 'error';

const ADMIN_OTP_COOLDOWN_KEY = 'slyce.adminOtpCooldownUntil';
const ADMIN_OTP_COOLDOWN_MS = 60_000;

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
      if (!isAdminSessionWithinMaximumAge()) {
        await client.auth.signOut();
        clearAdminSessionStart();
        if (active) { setState('signed-out'); setMessage('Your 30-day administrator session has expired. Enter your email to receive a new code.'); }
        return;
      }
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
    const handleCheck = () => {
      void check().catch(() => { if (active) { setState('error'); setMessage('The administrator session could not be verified.'); } });
    };
    handleCheck();
    const { data: listener } = client.auth.onAuthStateChange(handleCheck);
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (state === 'ready') return <>{children}</>;
  return <AdminAccessScreen state={state} message={message} {...(email ? { email } : {})} />;
}

function AdminAccessScreen({ state, email, message }: { state: GateState; email?: string; message: string }) {
  const [signInOpen, setSignInOpen] = useState(false);
  const signOut = async () => { await getAdminAuthClient().auth.signOut(); clearAdminSessionStart(); window.location.reload(); };
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
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'code' | 'verifying' | 'error'>('idle');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');

  const startCooldown = () => {
    window.localStorage.setItem(ADMIN_OTP_COOLDOWN_KEY, String(Date.now() + ADMIN_OTP_COOLDOWN_MS));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    const cooldownUntil = Number(window.localStorage.getItem(ADMIN_OTP_COOLDOWN_KEY) ?? 0);
    if (cooldownUntil > Date.now()) {
      const seconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setStatus('error');
      setError('A secure link was recently requested. Please wait ' + seconds + ' seconds before trying again.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const result = await getAdminAuthClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (result.error) {
        const isRateLimited = result.error.status === 429 || /rate limit|too many requests/i.test(result.error.message);
        if (isRateLimited) startCooldown();
        setStatus('error');
        setError(isRateLimited
          ? 'Too many secure links have been requested. Please wait at least one minute, then try again.'
          : result.error.message || 'Unable to send the secure link. Please try again.');
        return;
      }
      startCooldown();
      setEmail(normalizedEmail);
      setStep('code');
      setStatus('code');
    } catch {
      setStatus('error');
      setError('Unable to contact the authentication service. Please try again.');
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'verifying' || !/^\d{6}$/.test(code)) return;
    setStatus('verifying');
    setError('');
    try {
      const result = await getAdminAuthClient().auth.verifyOtp({ email, token: code, type: 'email' });
      if (result.error || !result.data.session) {
        setStatus('error');
        setError(result.error?.message || 'The code is invalid or has expired. Request a new code and try again.');
        return;
      }
      recordAdminSessionStart();
      onClose();
    } catch {
      setStatus('error');
      setError('Unable to verify the code. Please try again.');
    }
  };

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && status !== 'sending' && status !== 'verifying') onClose();
  }}>
    <section ref={modal} className="admin-auth-modal" role="dialog" aria-modal="true" aria-labelledby="admin-signin-title" onKeyDown={event => {
      if (event.key === 'Escape' && status !== 'sending' && status !== 'verifying') onClose();
      if (event.key === 'Tab') {
        const focusable = [...(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      }
    }}>
      <button className="admin-modal-close" type="button" aria-label="Close sign-in" onClick={onClose} disabled={status === 'sending' || status === 'verifying'}><X size={18} /></button>
      {step === 'code' ? <>
        <span className="admin-modal-icon admin-modal-success"><CheckCircle2 size={24} /></span>
        <p className="eyebrow">VERIFICATION CODE SENT</p>
        <h2 id="admin-signin-title">Enter your six-digit code.</h2>
        <p className="muted">We sent a one-time administrator code to <strong>{email}</strong>.</p>
        <form onSubmit={event => void verify(event)}>
          <label className="admin-email-label" htmlFor="admin-code">Verification code</label>
          <input id="admin-code" className="admin-email-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={status === 'verifying'} aria-describedby={status === 'error' ? 'admin-signin-error' : undefined} />
          {status === 'error' && <p className="admin-modal-error" id="admin-signin-error" role="alert">{error}</p>}
          <button className="button admin-modal-action" type="submit" disabled={status === 'verifying' || code.length !== 6}>{status === 'verifying' ? 'Verifying...' : 'Verify and sign in'}</button>
        </form>
        <button className="button secondary admin-modal-action" type="button" onClick={() => { setStep('email'); setStatus('idle'); setCode(''); setError(''); }}>Use another email</button>
      </> : <>
        <span className="admin-modal-icon"><Mail size={22} /></span>
        <p className="eyebrow">ADMINISTRATOR ACCESS</p>
        <h2 id="admin-signin-title">Enter your approved email.</h2>
        <p className="muted">We will send a six-digit sign-in code. Your email must be included in the administrator allowlist.</p>
        <form onSubmit={event => void submit(event)}>
          <label className="admin-email-label" htmlFor="admin-email">Email address</label>
          <input id="admin-email" className="admin-email-input" type="email" inputMode="email" autoComplete="email" autoFocus required placeholder="operator@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={status === 'sending'} aria-describedby={status === 'error' ? 'admin-signin-error' : undefined} />
          {status === 'error' && <p className="admin-modal-error" id="admin-signin-error" role="alert">{error}</p>}
          <button className="button admin-modal-action" type="submit" disabled={status === 'sending' || !email.trim()}>
            {status === 'sending' ? 'Sending code...' : <><span>Send verification code</span><ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="admin-modal-footnote">Access is granted only after Supabase verifies the email and the backend confirms administrator permission.</p>
      </>}
    </section>
  </div>;
}
