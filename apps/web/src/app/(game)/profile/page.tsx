import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Profile } from '../../../features/profile';
import styles from '../../../features/profile.module.css';
export const metadata: Metadata = { title: 'Profile' };
export default function ProfilePage() { return <div className={styles.profilePage}><PageHeading eyebrow="YOUR CORNER" title="Looking sharp.">Your wallet, collection and activity.</PageHeading><Profile /></div>; }
