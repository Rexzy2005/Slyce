import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Shop } from '../../../features/shop';
import styles from '../../../features/shop.module.css';
export const metadata: Metadata = { title: 'Shop' };
export default function ShopPage() { return <div className={styles.shopPage}><PageHeading eyebrow="THE NIGHT MARKET" title="A little extra edge.">Power up your play. Find a look that feels like you.</PageHeading><Shop /></div>; }
