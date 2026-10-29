'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { adminLogin, adminLogout, adminRequest } from './auth-client';
import styles from './admin-gate.module.css';

const INITIAL_ADMIN_EMAIL = '';

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
  if (state === 'loading' || state === 'error') return <main className={`admin-access ${styles.access}`}>
    <div className={`admin-access-card ${styles.statusCard}`} role={state === 'error' ? 'alert' : undefined}>
      <BrandLockup />
      <p className="eyebrow">OPERATIONS CONSOLE</p>
      <h1>{state === 'loading' ? 'Checking administrator access.' : 'Admin console unavailable.'}</h1><p className="muted">{message}</p>
      {state === 'loading' && <div className="admin-loading-bar" aria-label="Loading" />}
      {state === 'error' && <button className="button secondary" onClick={() => window.location.reload()}>Try again</button>}
    </div>
  </main>;
  return <AdminLogin onAuthenticated={() => setState('authenticated')} />;
}

function BrandLockup() {
  return <div className={styles.brandLockup}>
    <span className="brand">slyyce<span className="brand-dot">/</span></span>
    <span className={styles.brandRule} aria-hidden="true" />
    <span className={styles.brandContext}>ADMIN ACCESS</span>
  </div>;
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

  return <main className={`admin-access ${styles.access}`}>
    <div className={styles.accessGlow} aria-hidden="true" />
    <section className={styles.accessLayout} aria-label="Slyyce administrator sign in">
      <div className={styles.accessIntro}>
        <BrandLockup />
        <p className="eyebrow">SLYYCE CONTROL ROOM</p>
        <h2>Keep every<br /><span>slice fair.</span></h2>
        <p className={styles.introCopy}>A focused workspace for the people who protect the player experience, verify the signal, and keep the season moving.</p>
        <div className={styles.signal}><span className={styles.signalDot} /><span>Secure operator channel</span><Sparkles size={14} aria-hidden="true" /></div>
      </div>
      <div className={`admin-access-card ${styles.formCard}`}>
        <div className={styles.formHeading}>
          <span className={styles.formIcon}><LockKeyhole size={19} aria-hidden="true" /></span>
          <div><p className="eyebrow">OPERATOR SIGN-IN</p><span className={styles.formMeta}>Backend-authenticated access</span></div>
        </div>
        <h1>Sign in to Slyyce.</h1><p className="muted">Use your approved administrator credentials.</p>
        <form onSubmit={event => void submit(event)} className={styles.form}>
          <label className="admin-email-label" htmlFor="admin-email">Email address</label>
          <input id="admin-email" className="admin-email-input" type="email" inputMode="email" autoComplete="username" autoFocus required value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} />
          <label className="admin-email-label" htmlFor="admin-password">Password</label>
          <div className={`admin-password-field ${styles.passwordField}`}>
            <input id="admin-password" className="admin-email-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? 'admin-signin-error' : undefined} />
            <button type="button" className="admin-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={submitting}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {error && <p className="admin-modal-error" id="admin-signin-error" role="alert">{error}</p>}
          <button className={`button admin-primary-action ${styles.submit}`} type="submit" disabled={submitting || !email.trim() || !password}>{submitting ? 'Signing in...' : <>Sign in <ArrowRight size={16} aria-hidden="true" /></>}</button>
        </form>
      </div>
    </section>
    <p className={styles.accessFooter}>Slyyce / Operator workspace <span>•</span> Private system</p>
  </main>;
}

export async function signOutAdministrator(): Promise<void> {
  try { await adminLogout(); } finally { window.location.reload(); }
}
