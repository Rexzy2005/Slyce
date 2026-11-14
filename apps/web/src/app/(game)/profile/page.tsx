import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Profile } from '../../../features/profile';
import styles from '../../../features/profile.module.css';
export const metadata: Metadata = { title: 'Profile' };
export default function ProfilePage() { return <div className={styles.profilePage}><PageHeading eyebrow="PLAYER PROFILE" title="Your arcade, your way.">Your account, best runs and collection, all in one place.</PageHeading><Profile /></div>; }
