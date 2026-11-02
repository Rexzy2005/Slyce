// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletContext, type WalletState } from '../../src/web3/context';
import { SignInGate, VerifiedGate } from '../../src/web3/sign-in-gate';
import { MagicContext } from '../../src/web3/magic-context';
import { AccountButton } from '../../src/web3/account-button';
import { TabBar } from '../../src/components/tab-bar';
import { sessionStatus } from '../../src/web3/connected-state';
const mocks = vi.hoisted(() => ({ connectAsync: vi.fn(), signInWithEmail: vi.fn(), signedInEmail: vi.fn(), pathname: '/shop', verified: undefined as boolean | undefined, connectors: [{ id: 'magic' }, { id: 'injected' }] as { id: string }[] }));
vi.mock('wagmi', () => ({ useConnect: () => ({ connectAsync: mocks.connectAsync, connectors: mocks.connectors }), useDisconnect: () => ({ disconnectAsync: vi.fn() }), useAccount: () => ({ connector: { id: 'magic' } }), useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }) }));
vi.mock('../../src/web3/magic', () => ({ signInWithEmail: mocks.signInWithEmail, signedInEmail: mocks.signedInEmail }));
vi.mock('../../src/game/game-records', () => ({ useGameRecords: () => ({ verified: mocks.verified }) }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.pathname = '/shop'; mocks.verified = undefined; mocks.connectors = [{ id: 'magic' }, { id: 'injected' }]; delete (window as { ethereum?: unknown }).ethereum; });
const magic = {} as never;
const signedOut: WalletState = { live: true, status: 'disconnected', wrongNetwork: false, balance: { status: 'unavailable' } };
const withWallet = (wallet: WalletState, node: React.ReactNode) => render(<WalletContext value={wallet}>{node}</WalletContext>);
it('blocks the app until the player signs in with their email', async () => {
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  expect(screen.queryByText('secret app')).toBeNull();
  expect(screen.queryByText(/celo/i)).toBeNull();
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' ada@example.com ' } });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: { id: 'magic' } }));
  expect(mocks.signInWithEmail).toHaveBeenCalledWith(magic, 'ada@example.com');
});
it('lets a player with a browser wallet connect it instead of email', async () => {
  (window as { ethereum?: unknown }).ethereum = {};
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  fireEvent.click(screen.getByRole('button', { name: /i already have a wallet/i }));
  await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith(expect.objectContaining({ connector: { id: 'injected' } })));
  expect(mocks.signInWithEmail).not.toHaveBeenCalled();
});
it('uses WalletConnect for mobile wallets when no browser wallet exists, and explains when neither is available', async () => {
  mocks.connectors = [{ id: 'magic' }, { id: 'injected' }, { id: 'walletConnect' }];
  const { unmount } = render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  fireEvent.click(screen.getByRole('button', { name: /i already have a wallet/i }));
  await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith(expect.objectContaining({ connector: { id: 'walletConnect' } })));
  unmount();
  mocks.connectors = [{ id: 'magic' }, { id: 'injected' }];
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  fireEvent.click(screen.getByRole('button', { name: /i already have a wallet/i }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/no wallet found/i);
});
it('shows an error and stays signed out when the code is not confirmed', async () => {
  mocks.signInWithEmail.mockRejectedValueOnce(new Error('cancelled'));
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/try again/i);
  expect(mocks.connectAsync).not.toHaveBeenCalled();
});
it('shows the app once signed in on the right network', () => {
  withWallet({ ...signedOut, status: 'connected', address: '0x0000000000000000000000000000000000000001' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.getByText('secret app')).toBeTruthy();
});
it('asks a wallet on another network to switch instead of letting it in', () => {
  withWallet({ ...signedOut, status: 'connected', wrongNetwork: true, address: '0x0000000000000000000000000000000000000001' }, <SignInGate><p>secret app</p></SignInGate>);
  expect(screen.queryByText('secret app')).toBeNull();
  expect(screen.getByRole('button', { name: /switch network/i })).toBeTruthy();
});
it('only lets verified people play, but always allows verifying and the account page', () => {
  mocks.verified = false;
  const { rerender } = withWallet({ ...signedOut, status: 'connected' }, <VerifiedGate><p>game</p></VerifiedGate>);
  expect(screen.queryByText('game')).toBeNull();
  expect(screen.getByRole('link', { name: /verify now/i }).getAttribute('href')).toBe('/get-gd');
  mocks.pathname = '/get-gd';
  rerender(<WalletContext value={{ ...signedOut, status: 'connected' }}><VerifiedGate><p>game</p></VerifiedGate></WalletContext>);
  expect(screen.getByText('game')).toBeTruthy();
  mocks.pathname = '/play';
  mocks.verified = undefined;
  rerender(<WalletContext value={{ ...signedOut, status: 'connected' }}><VerifiedGate><p>game</p></VerifiedGate></WalletContext>);
  expect(screen.queryByText('game')).toBeNull();
  mocks.verified = true;
  rerender(<WalletContext value={{ ...signedOut, status: 'connected' }}><VerifiedGate><p>game</p></VerifiedGate></WalletContext>);
  expect(screen.getByText('game')).toBeTruthy();
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
it('lets a player verified before on this device straight in, and re-checks quietly', () => {
  const address = '0x00000000000000000000000000000000000000a1';
  window.localStorage.setItem('slyyce.verified.v1.' + address, '1');
  mocks.pathname = '/play';
  mocks.verified = undefined;
  const { rerender } = withWallet({ ...signedOut, status: 'connected', address }, <VerifiedGate><p>game</p></VerifiedGate>);
  expect(screen.getByText('game')).toBeTruthy();
  mocks.verified = false;
  rerender(<WalletContext value={{ ...signedOut, status: 'connected', address }}><VerifiedGate><p>game</p></VerifiedGate></WalletContext>);
  expect(screen.queryByText('game')).toBeNull();
  expect(window.localStorage.getItem('slyyce.verified.v1.' + address)).toBeNull();
});
it('account chip shows the email name, never a wallet address, and opens the profile', async () => {
  mocks.signedInEmail.mockResolvedValue('ada@example.com');
  render(<MagicContext value={magic}><WalletContext value={{ ...signedOut, status: 'connected', address: '0x1234567890abcdef1234567890abcdef12345678' }}><AccountButton /></WalletContext></MagicContext>);
  const link = screen.getByRole('link', { name: 'Your account' });
  expect(link.getAttribute('href')).toBe('/profile');
  await waitFor(() => expect(link.textContent).toContain('ada'));
  expect(link.textContent).not.toMatch(/0x/);
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
