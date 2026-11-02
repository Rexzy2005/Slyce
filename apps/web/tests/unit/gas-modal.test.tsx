// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { WalletContext, type WalletState } from '../../src/web3/context';
import { GasBanner } from '../../src/web3/gas-banner';
import { links } from '../../src/config/links';
afterEach(() => { cleanup(); window.sessionStorage.clear(); });
const address = '0x00000000000000000000000000000000000000a1';
const wallet = (gas: 'ok' | 'low'): WalletState => ({ live: true, status: 'connected', address, wrongNetwork: false, balance: { status: 'unavailable' }, gas });
it('asks a player with no fee balance to request a top-up on Telegram, with their account ID', async () => {
  render(<WalletContext value={wallet('low')}><GasBanner /></WalletContext>);
  const dialog = await screen.findByRole('dialog');
  expect(dialog.textContent).toContain(address);
  expect(screen.getByRole('link', { name: /request top-up on telegram/i }).getAttribute('href')).toBe(links.gasHelpTelegram);
  fireEvent.click(screen.getByRole('button', { name: /later/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('status').getAttribute('href')).toBe(links.gasHelpTelegram);
});
it('shows the banner instead of the pop-up once dismissed this session', async () => {
  window.sessionStorage.setItem('slyyce.gas-modal.dismissed', '1');
  render(<WalletContext value={wallet('low')}><GasBanner /></WalletContext>);
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('stays hidden when the account has a fee balance', () => {
  render(<WalletContext value={wallet('ok')}><GasBanner /></WalletContext>);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});
