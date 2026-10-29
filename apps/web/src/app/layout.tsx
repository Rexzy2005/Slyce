import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import tokens from '../design/tokens.json';
import { PwaRegistration } from '../pwa/registration';
import { publicConfig } from '../config/public';
import { Providers } from '../components/providers';
export const metadata: Metadata = {
  title: { default: 'Slyyce · Swipe. Slice. Stack your G$.', template: '%s · Slyyce' },
  description: 'Your next slice starts here. Off-chain play, tournaments and GoodDollar rewards.',
  applicationName: 'Slyyce', manifest: '/manifest.webmanifest',
  ...(publicConfig.appUrl ? { metadataBase: new URL(publicConfig.appUrl) } : {}),
  appleWebApp: { capable: true, title: 'Slyyce', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: tokens.night };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>
    {/* One wallet session for the whole app: route groups must not remount it, or players get signed out between screens. */}
    <Providers>{children}</Providers><PwaRegistration /></body></html>;
}
