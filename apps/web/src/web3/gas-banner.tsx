'use client';
import { useEffect, useState } from 'react';
import { links } from '../config/links';
import { useWallet } from './context';
import { Icon } from '../components/icon';
/**
 * New accounts start with no balance for network fees, so they can't save scores yet. A one-time pop-up per
 * session sends them to the Telegram channel to request a free top-up, with their account ID ready to copy;
 * after it is closed, a small banner keeps the same link until the top-up arrives.
 */
const dismissedKey = 'slyyce.gas-modal.dismissed';
function wasDismissed(): boolean { try { return window.sessionStorage.getItem(dismissedKey) === '1'; } catch { return false; } }
function rememberDismissed() { try { window.sessionStorage.setItem(dismissedKey, '1'); } catch { /* storage unavailable: show again next page */ } }

export function GasBanner() {
  const wallet = useWallet();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => { setDismissed(wasDismissed()); }, []);
  if (wallet.status !== 'connected' || wallet.gas !== 'low' || !wallet.address) return null;
  const close = () => { rememberDismissed(); setDismissed(true); };
  return dismissed
    ? <a href={links.gasHelpTelegram} target="_blank" rel="noreferrer" className="gas-banner" role="status"><strong>Your account needs a free top-up to save scores.</strong> Ask for it in our Telegram channel. <Icon name="arrow" size={15} /></a>
    : <GasModal accountId={wallet.address} onClose={close} />;
}

function GasModal({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const copy = () => { void navigator.clipboard?.writeText(accountId).then(() => setCopied(true), () => setCopied(false)); };
  return <div className="gas-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="gas-modal" role="dialog" aria-modal="true" aria-labelledby="gas-modal-title">
      <span className="eyebrow">ONE QUICK STEP</span>
      <h2 id="gas-modal-title">Get your free top-up</h2>
      <p>To save scores and win G$, your account needs a tiny top-up for network fees. It's free: ask in our Telegram channel and share your account ID below.</p>
      <div className="gas-modal-id">
        <code>{accountId}</code>
        <button className="button secondary" type="button" onClick={copy}>{copied ? <><Icon name="check" size={14} /> Copied</> : 'Copy'}</button>
      </div>
      <a className="button" href={links.gasHelpTelegram} target="_blank" rel="noreferrer" autoFocus>Request top-up on Telegram</a>
      <button className="text-button" type="button" onClick={onClose}>Later</button>
    </div>
  </div>;
}
