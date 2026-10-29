'use client';
import { useEffect, useState } from 'react';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const before = (event: Event) => {
      if (!('prompt' in event) || typeof event.prompt !== 'function' || !('userChoice' in event)) return;
      event.preventDefault(); setPrompt(event as InstallPrompt);
    };
    const complete = () => { setInstalled(true); setPrompt(undefined); };
    window.addEventListener('beforeinstallprompt', before); window.addEventListener('appinstalled', complete);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', complete); };
  }, []);
  if (installed) return <p className="muted">Slyyce is on your home screen.</p>;
  return <div className="install-control"><button className="button secondary" onClick={async () => {
    if (!prompt) { setHint(true); return; }
    try { await prompt.prompt(); await prompt.userChoice; } catch { setHint(true); } finally { setPrompt(undefined); }
  }}>Add to home screen</button>{hint && <p role="status" className="muted">If your browser supports installation, open its menu or Share options and choose “Add to Home Screen”.</p>}</div>;
}
