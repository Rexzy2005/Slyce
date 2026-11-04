'use client';
import { useEffect, useState } from 'react';
import { installContext, installPrompt, onInstallPromptChange, showInstallPrompt, type InstallContext } from './install-prompt';

const dismissKey = 'slyyce.install.dismissed-until';
const hidden = () => { try { return Number(window.localStorage.getItem(dismissKey) ?? 0) > Date.now(); } catch { return false; } };
const snooze = () => { try { window.localStorage.setItem(dismissKey, String(Date.now() + 7 * 86_400_000)); } catch { /* shows again next visit */ } };

function useInstallContext(): InstallContext | undefined {
  const [context, setContext] = useState<InstallContext>();
  useEffect(() => {
    const update = () => setContext(installContext(navigator.userAgent, window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true), !!installPrompt()));
    update();
    return onInstallPromptChange(update);
  }, []);
  return context;
}

const hints: Record<Exclude<InstallContext, 'installed' | 'native'>, string> = {
  ios: 'Tap the Share button (the square with an arrow), then “Add to Home Screen”.',
  'in-app': 'This in-app browser can’t install apps. Open slyyce.xyz in Chrome (Android) or Safari (iPhone), then install it from there.',
  manual: 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.',
};

/** Full install control (Profile page): always visible until installed. */
export function InstallButton() {
  const context = useInstallContext();
  const [hint, setHint] = useState(false);
  if (!context) return null;
  if (context === 'installed') return <p className="muted">Slyyce is on your home screen.</p>;
  return <div className="install-control">
    <button className="button secondary" onClick={() => { if (context === 'native') void showInstallPrompt(); else setHint(true); }}>Add to home screen</button>
    {hint && context !== 'native' && <p role="status" className="muted">{hints[context]}</p>}
  </div>;
}

/** Dismissible banner in the app shell; hidden once installed or for a week after "Not now". */
export function InstallBanner() {
  const context = useInstallContext();
  const [closed, setClosed] = useState(true);
  useEffect(() => { setClosed(hidden()); }, []);
  if (!context || context === 'installed' || closed) return null;
  const close = () => { snooze(); setClosed(true); };
  return <div className="install-banner" role="region" aria-label="Install Slyyce">
    <img src="/icons/icon-192.png" alt="" width={40} height={40} />
    <div><strong>Install Slyyce</strong><span>{context === 'native' ? 'Play full-screen from your home screen.' : hints[context]}</span></div>
    {context === 'native' && <button className="button" onClick={() => void showInstallPrompt()}>Install</button>}
    <button className="text-button" onClick={close} aria-label="Not now">✕</button>
  </div>;
}
