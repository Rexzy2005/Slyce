// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminGate } from '../../src/admin/admin-gate';

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/admin/supabase', () => ({
  recordAdminSessionStart: () => window.localStorage.setItem('slyce.adminSessionStartedAt', String(Date.now())),
  clearAdminSessionStart: () => window.localStorage.removeItem('slyce.adminSessionStartedAt'),
  isAdminSessionWithinMaximumAge: () => true,
  getAdminAuthClient: () => ({
    auth: {
      ...auth,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

vi.mock('../../src/config/public', () => ({ publicConfig: { backendUrl: 'https://backend.example.com' } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

it('uses a product modal for administrator email-code sign-in', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
  render(<AdminGate><p>Console</p></AdminGate>);

  const open = await screen.findByRole('button', { name: 'Email me a secure link' });
  fireEvent.click(open);
  expect(screen.getByRole('dialog', { name: 'Enter your approved email.' })).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Operator@Example.com ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));

  await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'operator@example.com',
    options: { shouldCreateUser: false },
  }));
  expect(await screen.findByRole('heading', { name: 'Enter your six-digit code.' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
  await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'operator@example.com', token: '123456', type: 'email' }));
});

it('shows authentication errors inside the modal', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded.', status: 429 } });
  render(<AdminGate><p>Console</p></AdminGate>);

  fireEvent.click(await screen.findByRole('button', { name: 'Email me a secure link' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));

  expect((await screen.findByRole('alert')).textContent).toContain('Too many secure links');
});

it('does not contact Supabase again during the OTP cooldown', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  window.localStorage.setItem('slyce.adminOtpCooldownUntil', String(Date.now() + 60_000));
  render(<AdminGate><p>Console</p></AdminGate>);

  fireEvent.click(await screen.findByRole('button', { name: 'Email me a secure link' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));

  expect((await screen.findByRole('alert')).textContent).toContain('recently requested');
  expect(auth.signInWithOtp).not.toHaveBeenCalled();
});
