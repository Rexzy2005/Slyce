import type { Metadata } from 'next';
import { PublicStats } from '../../features/public-stats';
export const metadata: Metadata = { title: 'Live stats', description: 'Slyce on-chain activity on Celo: rounds played, G$ prize pools and contracts.' };
export default function StatsPage() { return <main id="main" className="stats-page"><PublicStats /></main>; }
