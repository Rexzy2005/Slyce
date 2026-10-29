// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminGate } from '../../src/admin/admin-gate';

const auth = vi.hoisted(() => ({ request: vi.fn(), login: vi.fn(), logout: vi.fn() }));

vi.mock('../../src/admin/auth-client', () => ({
  adminRequest: auth.request,
  adminLogin: auth.login,
  adminLogout: auth.logout,
}));

vi.mock('../../src/config/public', () => ({ publicConfig: { backendUrl: 'https://backend.example.com' } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

it('uses a product form for administrator email-password sign-in', async () => {
  auth.request.mockResolvedValue(new Response(null, { status: 401 }));
  auth.login.mockResolvedValue(new Response('{}', { status: 200 }));
  render(<AdminGate><p>Console</p></AdminGate>);

  expect(await screen.findByRole('heading', { name: 'Sign in to Slyce.' })).toBeTruthy();
  const email = screen.getByLabelText('Email address') as HTMLInputElement;
  const password = screen.getByLabelText('Password') as HTMLInputElement;
  fireEvent.change(email, { target: { value: ' ADMIN@Example.com ' } });
  fireEvent.change(password, { target: { value: 'secret value' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(auth.login).toHaveBeenCalledWith('admin@example.com', 'secret value'));
  expect(await screen.findByText('Console')).toBeTruthy();
});

it('shows generic invalid-credentials errors in the form', async () => {
  auth.request.mockResolvedValue(new Response(null, { status: 401 }));
  auth.login.mockResolvedValue(new Response('{}', { status: 401 }));
  render(<AdminGate><p>Console</p></AdminGate>);
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'wrong password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect((await screen.findByRole('alert')).textContent).toBe('The email or password is incorrect.');
});

it('restores an existing backend cookie session without exposing a token', async () => {
  auth.request.mockResolvedValue(new Response('{}', { status: 200 }));
  render(<AdminGate><p>Console</p></AdminGate>);
  expect(await screen.findByText('Console')).toBeTruthy();
  expect(auth.login).not.toHaveBeenCalled();
});
