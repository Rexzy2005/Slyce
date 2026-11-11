import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './icon';
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="page-description">{children}</p>}</header>;
}
export function EmptyState({ title, children, action, icon = 'sparkles' }: { title: string; children: ReactNode; action?: ReactNode; icon?: IconName }) {
  return <div className="empty-state"><span className="empty-symbol"><Icon name={icon} /></span><h2>{title}</h2><div className="muted">{children}</div>{action}</div>;
}
export function FeatureLink({ href, title, description, icon, tone = 'mango' }: { href: string; title: string; description: string; icon: IconName; tone?: 'mango' | 'leaf' | 'sky' | 'melon' }) {
  return <Link className={'feature-card tone-' + tone} href={href}><span className="feature-icon"><Icon name={icon} /></span><div><h2>{title}</h2><p>{description}</p></div><Icon name="arrow" /></Link>;
}
export function UnavailableAction({ children }: { children: ReactNode }) { return <button className="button" disabled>{children}</button>; }
