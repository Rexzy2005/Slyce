'use client';
/**
 * Captures Chrome/Edge/Samsung's one-time `beforeinstallprompt` event as early as possible (it can fire before the
 * signed-in app mounts) so an in-app "Install" button can show the native dialog later.
 */
export interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export function captureInstallPrompt(): () => void {
  const before = (event: Event) => {
    if (!('prompt' in event) || typeof event.prompt !== 'function' || !('userChoice' in event)) return;
    event.preventDefault(); deferred = event as InstallPromptEvent; notify();
  };
  const installed = () => { deferred = undefined; notify(); };
  window.addEventListener('beforeinstallprompt', before); window.addEventListener('appinstalled', installed);
  return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', installed); };
}
export const installPrompt = () => deferred;
export function onInstallPromptChange(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = undefined; notify();
  try { await event.prompt(); return (await event.userChoice).outcome; } catch { return 'unavailable'; }
}

export type InstallContext = 'installed' | 'native' | 'ios' | 'in-app' | 'manual';
/** How this browser can install the app: natively, via Safari's Share menu, not at all (in-app browsers), or via the browser menu. */
export function installContext(userAgent: string, standalone: boolean, hasPrompt: boolean): InstallContext {
  if (standalone) return 'installed';
  if (/FBAN|FBAV|Instagram|Telegram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)/i.test(userAgent)) return 'in-app';
  if (hasPrompt) return 'native';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'manual';
}
