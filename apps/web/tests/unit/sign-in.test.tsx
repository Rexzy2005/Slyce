// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletContext, type WalletState } from '../../src/web3/context';
import { SignInGate, VerifyBanner, walletOptions } from '../../src/web3/sign-in-gate';
import { MagicContext } from '../../src/web3/magic-context';
import { AccountButton } from '../../src/web3/account-button';
import { TabBar } from '../../src/components/tab-bar';
import { sessionStatus } from '../../src/web3/connected-state';
const mocks = vi.hoisted(() => ({ connectAsync: vi.fn(), signInWithEmail: vi.fn(), signedInEmail: vi.fn(), pathname: '/shop', verified: undefined as boolean | undefined, connectors: [{ id: 'magic', name: 'Email', type: 'magic' }, { id: 'injected', name: 'Injected', type: 'injected' }] as { id: string; name: string; type: string; icon?: string }[] }));
vi.mock('wagmi', () => ({ useConnect: () => ({ connectAsync: mocks.connectAsync, connectors: mocks.connectors }), useDisconnect: () => ({ disconnectAsync: vi.fn() }), useAccount: () => ({ connector: { id: 'magic' } }), useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }) }));
vi.mock('../../src/web3/magic', () => ({ signInWithEmail: mocks.signInWithEmail, signedInEmail: mocks.signedInEmail }));
vi.mock('../../src/game/game-records', () => ({ useGameRecords: () => ({ verified: mocks.verified }) }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.pathname = '/shop'; mocks.verified = undefined; mocks.connectors = [{ id: 'magic', name: 'Email', type: 'magic' }, { id: 'injected', name: 'Injected', type: 'injected' }]; delete (window as { ethereum?: unknown }).ethereum; });
const magic = {} as never;
const signedOut: WalletState = { live: true, status: 'disconnected', wrongNetwork: false, balance: { status: 'unavailable' } };
const withWallet = (wallet: WalletState, node: React.ReactNode) => render(<WalletContext value={wallet}>{node}</WalletContext>);
it('blocks the app until the player signs in with their email', async () => {
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  expect(screen.queryByText('secret app')).toBeNull();
  expect(screen.queryByText(/celo/i)).toBeNull();
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' ada@example.com ' } });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: expect.objectContaining({ id: 'magic' }) }));
  expect(mocks.signInWithEmail).toHaveBeenCalledWith(magic, 'ada@example.com');
});
it('switches to a wallet list and connects the wallet the player taps', async () => {
  mocks.connectors = [{ id: 'magic', name: 'Email', type: 'magic' }, { id: 'injected', name: 'Injected', type: 'injected' }, { id: 'io.metamask', name: 'MetaMask', type: 'injected', icon: 'data:image/png;base64,AA' }, { id: 'metaMaskSDK', name: 'MetaMask', type: 'metaMask' }, { id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }];
  render(<MagicContext value={magic}><WalletContext value={signedOut}><SignInGate><p>secret app</p></SignInGate></WalletContext></MagicContext>);
  fireEvent.click(screen.getByRole('tab', { name: 'Wallet' }));
  expect(screen.queryByLabelText('Email address')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /metamask/i }));
  await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith(expect.objectContaining({ connector: expect.objectContaining({ id: 'io.metamask' }) })));
  expect(screen.getByRole('button', { name: /other wallets/i })).toBeTruthy();
  expect(mocks.signInWithEmail).not.toHaveBeenCalled();
});
it('lists detected wallets first, avoids duplicates and falls back to WalletConnect', () => {
  const base = [{ id: 'magic', name: 'Email', type: 'magic' }, { id: 'injected', name: 'Injected', type: 'injected' }, { id: 'metaMaskSDK', name: 'MetaMask', type: 'metaMask' }, { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet', type: 'coinbaseWallet' }, { id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }];
  expect(walletOptions(base, false).map(option => option.connectorId)).toEqual(['metaMaskSDK', 'coinbaseWalletSDK', 'walletConnect']);
  expect(walletOptions(base, true)[0]!.label).toBe('Browser wallet');
  const detected = [...base, { id: 'io.metamask', name: 'MetaMask', type: 'injected' }, { id: 'io.rabby', name: 'Rabby', type: 'injected' }];
  expect(walletOptions(detected, true).map(option => option.connectorId)).toEqual(['io.metamask', 'io.rabby', 'coinbaseWalletSDK', 'walletConnect']);
  expect(walletOptions([{ id: 'magic', name: 'Email', type: 'magic' }], false)).toEqual([]);
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
it('lets everyone play and only nudges unverified players to verify', () => {
  const address = '0x00000000000000000000000000000000000000a1';
  mocks.pathname = '/play';
  mocks.verified = false;
  const { rerender } = withWallet({ ...signedOut, status: 'connected', address }, <><VerifyBanner /><p>game</p></>);
  expect(screen.getByText('game')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Verify' }).getAttribute('href')).toBe('/get-gd');
  expect(screen.getByRole('region', { name: /verify/i }).textContent).toContain('Already verified? Sign in with that wallet.');
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByRole('region', { name: /verify/i })).toBeNull();
  window.sessionStorage.clear();
  mocks.verified = true;
  rerender(<WalletContext value={{ ...signedOut, status: 'connected', address }}><VerifyBanner /><p>game</p></WalletContext>);
  expect(screen.queryByRole('region', { name: /verify/i })).toBeNull();
  expect(screen.getByText('game')).toBeTruthy();
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
  expect(screen.getByRole('link', { name: 'Ranks' }).getAttribute('href')).toBe('/leaderboard');
  expect(screen.getAllByRole('link')).toHaveLength(6);
});
it('keeps a signed-in player on a loading screen while their session is restored', () => {
  expect(sessionStatus({ status: 'disconnected' }, true)).toBe('connecting');
  expect(sessionStatus({ status: 'reconnecting' }, false)).toBe('connecting');
  expect(sessionStatus({ status: 'connected' }, true)).toBe('connected');
  expect(sessionStatus({ status: 'disconnected' }, false)).toBe('disconnected');
});
