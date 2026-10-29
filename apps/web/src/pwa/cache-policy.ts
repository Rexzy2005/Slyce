/** Only content-addressed Next chunks and checked-in immutable public assets. */
export function safePrecachePath(value: string): boolean {
  const url = new URL(value, 'https://slyyce.invalid');
  if (url.origin !== 'https://slyyce.invalid' || url.search) return false;
  return url.pathname.startsWith('/_next/static/') || /^\/icons\/icon-(192|512)\.png$/.test(url.pathname) || url.pathname === '/game/chopping-board-v1.webp' || url.pathname === '/game/fruit-splash-v1.webp' || url.pathname === '/offline.html' || url.pathname === '/font/typography.css' || url.pathname === '/font/SpaceGrotesk.ttf' || url.pathname === '/font/Rajdhani-Medium.ttf' || url.pathname === '/font/Rajdhani-Bold.ttf';
}
