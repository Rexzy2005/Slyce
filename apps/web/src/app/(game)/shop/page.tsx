import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Shop } from '../../../features/shop';
import styles from '../../../features/shop.module.css';
export const metadata: Metadata = { title: 'Shop' };
export default function ShopPage() { return <div className={styles.shopPage}><PageHeading eyebrow="THE NIGHT MARKET" title="Make every slice yours.">Build your look, stock up for your next run, and bring a little more Slyyce to the board.</PageHeading><Shop /></div>; }
