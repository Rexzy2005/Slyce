import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Shop } from '../../../features/shop';
import styles from '../../../features/shop.module.css';
export const metadata: Metadata = { title: 'Shop' };
export default function ShopPage() { return <div className={styles.shopPage}><PageHeading eyebrow="THE NIGHT MARKET" title="Make your next run yours.">Fresh trails, fruit skins, boards, and extra lives.</PageHeading><Shop /></div>; }
