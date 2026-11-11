'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icon';
export const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: '/play', label: 'Play', icon: 'play' }, { href: '/tournament', label: 'Compete', icon: 'trophy' }, { href: '/leaderboard', label: 'Ranks', icon: 'chart' },
  { href: '/shop', label: 'Shop', icon: 'bag' }, { href: '/get-gd', label: 'Get G$', icon: 'leaf' }, { href: '/profile', label: 'Me', icon: 'user' },
];
export function TabBar() {
  const pathname = usePathname();
  return <nav className="tab-bar" aria-label="App navigation">{tabs.map(tab => {
    const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
    return <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}><Icon name={tab.icon} /><span>{tab.label}</span></Link>;
  })}</nav>;
}
