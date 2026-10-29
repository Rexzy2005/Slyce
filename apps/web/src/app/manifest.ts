import type { MetadataRoute } from 'next';
import tokens from '../design/tokens.json';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Slyyce', short_name: 'Slyyce', description: 'Swipe. Slice. Stack your G$.', start_url: '/play', scope: '/', display: 'standalone', orientation: 'portrait', background_color: tokens.night, theme_color: tokens.night,
    icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
}
