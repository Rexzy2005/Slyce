'use client';
import { useEffect } from 'react';
import { isProduction } from '../config/public';
export function PwaRegistration() {
  useEffect(() => {
    if (!isProduction || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Online navigation remains usable; do not claim offline readiness on failure.
      console.warn('Slyyce offline support could not be registered.');
    });
  }, []);
  return null;
}
