'use client';
import { useEffect } from 'react';
import { isProduction } from '../config/public';
import { captureInstallPrompt } from './install-prompt';
export function PwaRegistration() {
  // Mounted at the root so the one-time install event is captured before the signed-in app renders.
  useEffect(() => captureInstallPrompt(), []);
  useEffect(() => {
    if (!isProduction || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Online navigation remains usable; do not claim offline readiness on failure.
      console.warn('Slyyce offline support could not be registered.');
    });
  }, []);
  return null;
}
