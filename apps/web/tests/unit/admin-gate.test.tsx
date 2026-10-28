// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminGate } from '../../src/admin/admin-gate';

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/admin/supabase', () => ({
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
});

it('uses a product modal for administrator email-link sign-in', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  render(<AdminGate><p>Console</p></AdminGate>);

  const open = await screen.findByRole('button', { name: 'Email me a secure link' });
  fireEvent.click(open);
  expect(screen.getByRole('dialog', { name: 'Enter your approved email.' })).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Operator@Example.com ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send secure link' }));

  await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'operator@example.com',
    options: { emailRedirectTo: `${window.location.origin}/admin` },
  }));
  expect(await screen.findByRole('heading', { name: 'Check your inbox.' })).toBeTruthy();
});

it('shows authentication errors inside the modal', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded.' } });
  render(<AdminGate><p>Console</p></AdminGate>);

  fireEvent.click(await screen.findByRole('button', { name: 'Email me a secure link' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send secure link' }));

  expect((await screen.findByRole('alert')).textContent).toContain('Email rate limit exceeded.');
});
