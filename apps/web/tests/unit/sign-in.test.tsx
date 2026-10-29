// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletContext, type WalletState } from '../../src/web3/context';
import { SignInGate } from '../../src/web3/sign-in-gate';
import { AccountButton } from '../../src/web3/account-button';
import { TabBar } from '../../src/components/tab-bar';
import { sessionStatus } from '../../src/web3/connected-state';
const open = vi.hoisted(() => vi.fn());
vi.mock('@reown/appkit/react', () => ({ useAppKit: () => ({ open }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/shop' }));
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => { cleanup(); open.mockReset(); });
const signedOut: WalletState = { status: 'disconnected', wrongNetwork: false, balance: { status: 'unavailable' } };
const withWallet = (wallet: WalletState, node: React.ReactNode) => render(<WalletContext value={wallet}>{node}</WalletContext>);
it('blocks the app until the player signs in with email or a wallet', () => {
  withWallet(signedOut, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.queryByText('secret app')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /sign in with email or wallet/i }));
  expect(open).toHaveBeenCalledWith();
});
it('shows the app once signed in on the right network', () => {
  withWallet({ ...signedOut, status: 'connected', address: '0x0000000000000000000000000000000000000001' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.getByText('secret app')).toBeTruthy();
});
it('asks to switch network instead of letting a wrong-network wallet in', () => {
  withWallet({ ...signedOut, status: 'connected', wrongNetwork: true, address: '0x0000000000000000000000000000000000000001' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.queryByText('secret app')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /switch to celo/i }));
  expect(open).toHaveBeenCalledWith({ view: 'Networks' });
});
it('never opens the app when sign-in is not configured', () => {
  withWallet({ ...signedOut, status: 'unavailable', message: 'Not configured.' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.queryByText('secret app')).toBeNull();
  expect(screen.getByRole('alert').textContent).toBe('Not configured.');
});
it('shows a loading state while connecting', () => {
  withWallet({ ...signedOut, status: 'connecting' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.queryByText('secret app')).toBeNull();
  expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
});
it('account button opens the account view with a shortened address', () => {
  withWallet({ ...signedOut, status: 'connected', address: '0x1234567890abcdef1234567890abcdef12345678' }, <AccountButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  expect(open).toHaveBeenCalledWith({ view: 'Account' });
  expect(screen.getByText(/0x1234…5678/)).toBeTruthy();
});
it('tab bar marks the current destination', () => {
  render(<TabBar />);
  expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Play' }).getAttribute('aria-current')).toBeNull();
  expect(screen.getAllByRole('link')).toHaveLength(5);
});
it('keeps a signed-in player on a loading screen while their session is restored', () => {
  expect(sessionStatus({ status: 'disconnected' }, true)).toBe('connecting');
  expect(sessionStatus({ status: 'reconnecting' }, false)).toBe('connecting');
  expect(sessionStatus({ status: 'connected' }, true)).toBe('connected');
  expect(sessionStatus({ status: 'disconnected' }, false)).toBe('disconnected');
});
