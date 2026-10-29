'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { adminLogin, adminLogout, adminRequest } from './auth-client';

const INITIAL_ADMIN_EMAIL = 'timothypererat2004@gmail.com';

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'signed-out' | 'authenticated' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your administrator session.');

  useEffect(() => {
    let active = true;
    void adminRequest('/api/v1/session').then(response => {
      if (!active) return;
      if (response.ok) setState('authenticated');
      else if (response.status === 401 || response.status === 403) setState('signed-out');
      else { setState('error'); setMessage('The administrator service is temporarily unavailable.'); }
    }).catch(() => { if (active) { setState('error'); setMessage('Unable to reach the administrator service.'); } });
    return () => { active = false; };
  }, []);

  if (state === 'authenticated') return children;
  if (state === 'loading' || state === 'error') return <main className="admin-access"><div className="admin-access-card">
    <span className="brand">slyce<span className="brand-dot">/</span></span><p className="eyebrow">OPERATIONS CONSOLE</p>
    <h1>{state === 'loading' ? 'Checking administrator access.' : 'Admin console unavailable.'}</h1><p className="muted">{message}</p>
    {state === 'loading' && <div className="admin-loading-bar" aria-label="Loading" />}
    {state === 'error' && <button className="button secondary" onClick={() => window.location.reload()}>Try again</button>}
  </div></main>;
  return <AdminLogin onAuthenticated={() => setState('authenticated')} />;
}

function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState(INITIAL_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      const response = await adminLogin(email.trim().toLowerCase(), password);
      if (response.ok) { setPassword(''); onAuthenticated(); return; }
      if (response.status === 429) setError('Too many sign-in attempts. Please wait before trying again.');
      else if (response.status === 401 || response.status === 403) setError('The email or password is incorrect.');
      else setError('The administrator service could not complete sign-in. Please try again.');
    } catch { setError('Unable to reach the administrator service. Check your connection and try again.'); }
    finally { setSubmitting(false); }
  };

  return <main className="admin-access"><div className="admin-access-card">
    <span className="brand">slyce<span className="brand-dot">/</span></span><p className="eyebrow">OPERATIONS CONSOLE</p>
    <h1>Sign in to Slyce.</h1><p className="muted">Use your approved administrator credentials.</p>
    <form onSubmit={event => void submit(event)}>
      <label className="admin-email-label" htmlFor="admin-email">Email address</label>
      <input id="admin-email" className="admin-email-input" type="email" inputMode="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} />
      <label className="admin-email-label" htmlFor="admin-password">Password</label>
      <div className="admin-password-field">
        <input id="admin-password" className="admin-email-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? 'admin-signin-error' : undefined} />
        <button type="button" className="admin-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={submitting}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {error && <p className="admin-modal-error" id="admin-signin-error" role="alert">{error}</p>}
      <button className="button admin-primary-action" type="submit" disabled={submitting || !email.trim() || !password}>{submitting ? 'Signing in...' : 'Sign in'}</button>
    </form>
    <p className="admin-modal-footnote"><ShieldCheck size={14} aria-hidden="true" /> Authentication and authorization are enforced by the Slyce backend.</p>
  </div></main>;
}

export async function signOutAdministrator(): Promise<void> {
  try { await adminLogout(); } finally { window.location.reload(); }
}
